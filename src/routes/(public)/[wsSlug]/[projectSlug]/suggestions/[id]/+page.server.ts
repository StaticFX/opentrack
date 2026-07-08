import { error, fail, redirect } from '@sveltejs/kit';
import type { SuggestionDecision } from '$lib/constants';
import { SUGGESTION_DECISIONS } from '$lib/constants';
import { ACCESS, canComment, canManageProject, publicInteractionLocked } from '$lib/server/permissions';
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
import { applyDecision, convertToTicket, getSuggestion } from '$lib/server/services/suggestions';
import { countVotes, hasVoted } from '$lib/server/services/votes';
import { resolveVoter } from '$lib/server/util/anon';
import type { Actions, PageServerLoad } from './$types';

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

	const interactionsLocked = publicInteractionLocked(s.status !== 'open', p.level);
	return {
		suggestion: s,
		suggestionReactions,
		comments: commentsWithReactions,
		votes,
		voted,
		watching,
		interactionsLocked,
		canComment:
			!interactionsLocked &&
			canComment(locals.user, p.level, p.effectiveVisibility, p.project.allowPublicComments),
		canTriage: p.canTriage,
		signedIn: p.signedIn
	};
};

async function requireTriage(locals: App.Locals, wsSlug: string, projectSlug: string) {
	const ctx = await getBySlugs(locals.user, wsSlug, projectSlug);
	if (!ctx) throw error(404, 'Not found');
	if (!canManageProject(ctx.level)) throw error(403, 'Not allowed');
	return ctx;
}

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
	},

	resolve: async ({ request, params, locals }) => {
		const ctx = await requireTriage(locals, params.wsSlug, params.projectSlug);
		const formData = await request.formData();
		const status = String(formData.get('status') ?? '') as SuggestionDecision;
		const note = String(formData.get('note') ?? '').trim();
		if (!SUGGESTION_DECISIONS.includes(status)) return fail(400, { error: 'Invalid decision.' });

		await applyDecision({
			actor: locals.user!,
			projectId: ctx.project.id,
			suggestionId: params.id,
			decision: status,
			note: note || undefined
		});
		return { statusSet: true };
	},

	convert: async ({ params, locals }) => {
		await requireTriage(locals, params.wsSlug, params.projectSlug);
		const result = await convertToTicket(locals.user!, params.id);
		if (!result) return fail(400, { error: 'Could not convert — the project has no board.' });
		return { converted: true };
	},

	merge: async ({ request, params, locals }) => {
		const ctx = await requireTriage(locals, params.wsSlug, params.projectSlug);
		const targetId = String((await request.formData()).get('targetId') ?? '');
		if (!targetId) return fail(400, { error: 'Pick a suggestion to merge into.' });
		const { mergeSuggestion } = await import('$lib/server/services/suggestions');
		const result = await mergeSuggestion(params.id, targetId);
		if (!result) return fail(400, { error: 'Could not merge — invalid target.' });

		// Record the merge on both threads + notify followers of the canonical one.
		await addComment('suggestion', params.id, locals.user!.id, `Merged into **${result.targetTitle}** — votes and followers moved there.`);
		const { logActivity } = await import('$lib/server/services/activity');
		await logActivity({ projectId: ctx.project.id, subjectType: 'suggestion', subjectId: params.id, actorId: locals.user?.id, type: 'suggestion.status', data: { status: 'duplicate' } });
		await notifyWatchers({
			type: 'suggestion.status',
			subjectType: 'suggestion',
			subjectId: targetId,
			actorId: locals.user?.id,
			body: `A duplicate ("${result.sourceTitle}") was merged in`
		});
		return { merged: true };
	}
};
