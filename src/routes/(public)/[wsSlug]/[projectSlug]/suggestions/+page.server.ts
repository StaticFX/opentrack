import { error, fail, redirect } from '@sveltejs/kit';
import type { SuggestionKind, SuggestionStatus } from '$lib/constants';
import { SUGGESTION_KINDS, SUGGESTION_STATUSES } from '$lib/constants';
import { ACCESS } from '$lib/server/permissions';
import { createSuggestion, listSuggestions, type SuggestionSort } from '$lib/server/services/suggestions';
import { resolveVoter } from '$lib/server/util/anon';
import type { Actions, PageServerLoad } from './$types';

const SORTS: SuggestionSort[] = ['top', 'new', 'trending'];

export const load: PageServerLoad = async ({ parent, url, locals, cookies, getClientAddress }) => {
	const p = await parent();
	const sort = (SORTS.includes(url.searchParams.get('sort') as SuggestionSort)
		? url.searchParams.get('sort')
		: 'top') as SuggestionSort;
	const statusParam = url.searchParams.get('status') ?? 'all';
	const status = (SUGGESTION_STATUSES.includes(statusParam as SuggestionStatus)
		? statusParam
		: 'all') as SuggestionStatus | 'all';
	const kindParam = url.searchParams.get('kind');
	const kind = (SUGGESTION_KINDS.includes(kindParam as SuggestionKind) ? kindParam : null) as
		| SuggestionKind
		| null;

	const voter = resolveVoter(locals.user, cookies, getClientAddress);
	const { cards, votedIds } = await listSuggestions(p.project.id, {
		sort,
		status,
		kind: kind ?? undefined,
		publicOnly: p.level < ACCESS.VIEWER,
		voter
	});

	return {
		suggestions: cards.map((c) => ({ ...c, voted: votedIds.has(c.id) })),
		sort,
		status,
		kind,
		canSubmit: p.signedIn,
		// Members keep interacting with resolved suggestions; the public does not.
		isMember: p.level >= ACCESS.VIEWER
	};
};

export const actions: Actions = {
	submit: async ({ request, locals, params }) => {
		if (!locals.user) throw redirect(302, '/auth/login');
		const { rateLimit } = await import('$lib/server/util/ratelimit');
		if (!rateLimit(`suggest:${locals.user.id}`, 10, 60_000)) return fail(429, { error: 'Slow down — try again in a minute.', title: '' });
		const { getBySlugs } = await import('$lib/server/services/projects');
		const ctx = await getBySlugs(locals.user, params.wsSlug, params.projectSlug);
		if (!ctx) throw error(404, 'Not found');
		if (ctx.level === ACCESS.NONE && ctx.visibility !== 'public') throw error(404, 'Not found');

		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const body = String(form.get('body') ?? '').trim() || undefined;
		const kindRaw = String(form.get('kind') ?? 'suggestion');
		const kind = (SUGGESTION_KINDS.includes(kindRaw as SuggestionKind) ? kindRaw : 'suggestion') as SuggestionKind;
		if (!title) return fail(400, { error: 'Give your feedback a title.', title: '' });

		const id = await createSuggestion(locals.user, ctx.project.id, { title, body, kind });
		const { logActivity } = await import('$lib/server/services/activity');
		await logActivity({ projectId: ctx.project.id, subjectType: 'suggestion', subjectId: id, actorId: locals.user.id, type: 'suggestion.created' });

		// The author follows their own suggestion; maintainers get a triage alert.
		const { watch, notifyUsers, listProjectMaintainerIds } = await import(
			'$lib/server/services/notifications'
		);
		await watch('suggestion', id, locals.user.id, 'author');
		const maintainers = (await listProjectMaintainerIds(ctx.project.id)).filter(
			(uid) => uid !== locals.user!.id
		);
		await notifyUsers(maintainers, {
			type: 'suggestion.created',
			subjectType: 'suggestion',
			subjectId: id,
			actorId: locals.user.id,
			body: kind === 'bug' ? `${locals.user.displayName} reported a bug` : `${locals.user.displayName} suggested this`
		});

		const { notifyIntegrations } = await import('$lib/server/integrations/notify');
		await notifyIntegrations(ctx.project.id, 'suggestion.created', 'suggestion', id, {
			actor: locals.user.displayName,
			description: body
		});
		throw redirect(303, `/${params.wsSlug}/${params.projectSlug}/suggestions/${id}`);
	}
};
