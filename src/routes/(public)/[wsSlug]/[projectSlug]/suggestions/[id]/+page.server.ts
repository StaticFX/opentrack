import { error, fail, redirect } from '@sveltejs/kit';
import { ACCESS, canComment, publicInteractionLocked } from '$lib/server/permissions';
import { addComment, listComments } from '$lib/server/services/comments';
import {
	isWatching,
	notifyUsers,
	notifyWatchers,
	parseMentions,
	resolveMentions,
	watch
} from '$lib/server/services/notifications';
import { getBySlugs } from '$lib/server/services/projects';
import { reactionsFor, summarize } from '$lib/server/services/reactions';
import { releaseForTicket } from '$lib/server/services/releases';
import { getSuggestion } from '$lib/server/services/suggestions';
import { getConvertedTicketSummary } from '$lib/server/services/tickets';
import { countVotes, hasVoted } from '$lib/server/services/votes';
import { resolveVoter } from '$lib/server/util/anon';
import type { Actions, PageServerLoad } from './$types';

type JourneyStage =
	| 'open'
	| 'accepted'
	| 'declined'
	| 'merged'
	| 'queued'
	| 'building'
	| 'shipped'
	| 'closed';

export const load: PageServerLoad = async ({ parent, params, locals, cookies, getClientAddress }) => {
	const p = await parent();
	const s = await getSuggestion(params.id);
	if (!s || s.projectId !== p.project.id) throw error(404, 'Not found');
	const visible = (p.effectiveVisibility === 'public' && s.isPublic) || p.level >= ACCESS.VIEWER;
	if (!visible) throw error(404, 'Not found');

	const voter = resolveVoter(locals.user, cookies, getClientAddress);
	const [comments, votes, voted, watching] = await Promise.all([
		listComments('suggestion', s.id),
		countVotes('suggestion', s.id),
		hasVoted('suggestion', s.id, voter),
		locals.user ? isWatching('suggestion', s.id, locals.user.id) : Promise.resolve(false)
	]);

	// Emoji reactions: suggestion-level + a batch for its comments.
	const uid = locals.user?.id;
	const [suggestionReactions, commentReactions] = await Promise.all([
		summarize('suggestion', s.id, uid),
		reactionsFor('comment', comments.map((c) => c.id), uid)
	]);
	const commentsWithReactions = comments.map((c) => ({ ...c, reactions: commentReactions.get(c.id) ?? [] }));

	// ---- The Journey: where this idea sits on the track. Stage is derived
	// HERE (single source of truth); the linked ticket's details are withheld
	// when it isn't publicly visible (stage alone reveals only progress).
	const base = `/${params.wsSlug}/${params.projectSlug}`;
	let stage: JourneyStage = 'open';
	if (s.status === 'accepted') stage = 'accepted';
	else if (s.status === 'declined') stage = 'declined';
	else if (s.status === 'duplicate') stage = 'merged';
	else if (s.status === 'converted') stage = 'queued';

	let journeyTicket = null;
	if (s.status === 'converted' && s.convertedTicketId) {
		const t = await getConvertedTicketSummary(s.convertedTicketId);
		if (t) {
			if (t.columnCategory === 'canceled') stage = 'closed';
			else if (t.closedAt || t.columnCategory === 'done') stage = 'shipped';
			else if (t.columnCategory === 'in_progress') stage = 'building';
			else stage = 'queued';

			const ticketVisible =
				(p.effectiveVisibility === 'public' && t.visibility !== 'private' && !t.archived) ||
				p.level >= ACCESS.VIEWER;
			if (ticketVisible) {
				const rel = stage === 'shipped' ? await releaseForTicket(t.id) : null;
				journeyTicket = {
					number: t.number,
					url: `${base}/t/${t.number}`,
					columnName: t.columnName,
					assignees: t.assignees.map((a) => ({ displayName: a.displayName, avatarUrl: a.avatarUrl })),
					pr:
						t.githubPrNumber && t.githubRepo
							? {
									number: t.githubPrNumber,
									state: t.githubPrState ?? 'open',
									url: `https://github.com/${t.githubRepo}/pull/${t.githubPrNumber}`
								}
							: null,
					release: rel ? { version: rel.version, url: `${base}/releases` } : null
				};
			}
		}
	}
	const journey = {
		stage,
		postedAt: s.createdAt,
		votes,
		kind: s.kind,
		duplicateOf:
			s.duplicateOfId && s.duplicateOfTitle
				? { id: s.duplicateOfId, title: s.duplicateOfTitle, url: `${base}/suggestions/${s.duplicateOfId}` }
				: null,
		ticket: journeyTicket
	};

	const interactionsLocked = publicInteractionLocked(s.status !== 'open', p.level);
	return {
		suggestion: s,
		journey,
		suggestionReactions,
		comments: commentsWithReactions,
		votes,
		voted,
		watching,
		interactionsLocked,
		canComment:
			!interactionsLocked &&
			canComment(locals.user, p.level, p.effectiveVisibility, p.project.allowPublicComments),
		signedIn: p.signedIn
	};
};

// Triage (accept/decline/convert/merge) lives in the internal Inbox, not on the
// public page — see /w/[wsSlug]/p/[projectSlug]/inbox.
export const actions: Actions = {
	comment: async ({ request, params, locals }) => {
		if (!locals.user) throw redirect(302, '/auth/login');
		const ctx = await getBySlugs(locals.user, params.wsSlug, params.projectSlug);
		if (!ctx) throw error(404, 'Not found');
		// A resolved suggestion is locked to public commenting (members are unaffected).
		const s = await getSuggestion(params.id);
		if (s && publicInteractionLocked(s.status !== 'open', ctx.level)) {
			return fail(403, { error: 'This suggestion has been resolved and is closed to further comments.' });
		}
		if (!canComment(locals.user, ctx.level, ctx.visibility, ctx.project.allowPublicComments)) {
			return fail(403, { error: 'Comments are not open on this project.' });
		}
		const body = String((await request.formData()).get('body') ?? '').trim();
		if (!body) return fail(400, { error: 'Comment cannot be empty.' });
		await addComment('suggestion', params.id, locals.user.id, body);

		await watch('suggestion', params.id, locals.user.id, 'commented');
		const mentionIds = (await resolveMentions(parseMentions(body))).filter(
			(uid) => uid !== locals.user!.id
		);
		if (mentionIds.length) {
			await Promise.all(mentionIds.map((uid) => watch('suggestion', params.id, uid, 'mention')));
			await notifyUsers(mentionIds, {
				type: 'mention',
				subjectType: 'suggestion',
				subjectId: params.id,
				actorId: locals.user.id,
				body: `${locals.user.displayName} mentioned you`
			});
		}
		await notifyWatchers({
			type: 'suggestion.commented',
			subjectType: 'suggestion',
			subjectId: params.id,
			actorId: locals.user.id,
			body: `${locals.user.displayName} commented`,
			exclude: mentionIds
		});
		return { commented: true };
	}
};
