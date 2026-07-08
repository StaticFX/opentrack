import { error, fail } from '@sveltejs/kit';
import {
	SUGGESTION_DECISIONS,
	SUGGESTION_KINDS,
	type SuggestionDecision,
	type SuggestionKind
} from '$lib/constants';
import { canManageProject } from '$lib/server/permissions';
import { getBySlugs } from '$lib/server/services/projects';
import {
	applyDecision,
	archiveSuggestion,
	convertToTicket,
	getSuggestion,
	inboxCounts,
	listSuggestions,
	unarchiveSuggestion,
	type ListOptions,
	type SuggestionSort
} from '$lib/server/services/suggestions';
import type { Actions, PageServerLoad } from './$types';

const VIEWS = ['triage', 'accepted', 'declined', 'converted', 'all', 'archived'] as const;
type View = (typeof VIEWS)[number];
const SORTS: SuggestionSort[] = ['top', 'new', 'trending'];

/** Map a UI tab to the list filter (status + archived handling). */
function optsForView(view: View): Pick<ListOptions, 'status' | 'archived'> {
	switch (view) {
		case 'triage':
			return { status: 'open', archived: 'exclude' };
		case 'accepted':
			return { status: 'accepted', archived: 'exclude' };
		case 'declined':
			return { status: 'declined', archived: 'exclude' };
		case 'converted':
			return { status: 'converted', archived: 'exclude' };
		case 'archived':
			return { status: 'all', archived: 'only' };
		case 'all':
		default:
			return { status: 'all', archived: 'exclude' };
	}
}

export const load: PageServerLoad = async ({ parent, params, url }) => {
	const p = await parent();
	if (!p.canManageProject) throw error(403, 'Maintainers only');

	const viewParam = url.searchParams.get('view');
	const view = (VIEWS.includes(viewParam as View) ? viewParam : 'triage') as View;
	const sortParam = url.searchParams.get('sort');
	const sort = (SORTS.includes(sortParam as SuggestionSort) ? sortParam : 'top') as SuggestionSort;
	const kindParam = url.searchParams.get('kind');
	const kind = (SUGGESTION_KINDS.includes(kindParam as SuggestionKind) ? kindParam : null) as
		| SuggestionKind
		| null;

	const [{ cards }, counts] = await Promise.all([
		listSuggestions(p.project.id, { ...optsForView(view), kind: kind ?? undefined, sort }),
		inboxCounts(p.project.id)
	]);

	return {
		suggestions: cards,
		counts,
		view,
		sort,
		kind,
		wsSlug: params.wsSlug,
		projectSlug: params.projectSlug
	};
};

/** Re-check maintainer access and scope the target suggestion to this project. */
async function requireOwned(locals: App.Locals, wsSlug: string, projectSlug: string, id: string) {
	const ctx = await getBySlugs(locals.user, wsSlug, projectSlug);
	if (!ctx) throw error(404, 'Not found');
	if (!canManageProject(ctx.level)) throw error(403, 'Not allowed');
	if (!id) return { ctx, fail: fail(400, { error: 'Missing suggestion.' }) };
	const s = await getSuggestion(id);
	if (!s || s.projectId !== ctx.project.id) return { ctx, fail: fail(404, { error: 'Not found.' }) };
	return { ctx, fail: null };
}

export const actions: Actions = {
	resolve: async ({ request, params, locals }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		const decision = String(fd.get('status') ?? '') as SuggestionDecision;
		const note = String(fd.get('note') ?? '').trim();
		const { ctx, fail: f } = await requireOwned(locals, params.wsSlug, params.projectSlug, id);
		if (f) return f;
		if (!SUGGESTION_DECISIONS.includes(decision)) return fail(400, { error: 'Invalid decision.' });
		await applyDecision({
			actor: locals.user!,
			projectId: ctx.project.id,
			suggestionId: id,
			decision,
			note: note || undefined
		});
		return { ok: true };
	},

	convert: async ({ request, params, locals }) => {
		const id = String((await request.formData()).get('id') ?? '');
		const { fail: f } = await requireOwned(locals, params.wsSlug, params.projectSlug, id);
		if (f) return f;
		const result = await convertToTicket(locals.user!, id);
		if (!result) return fail(400, { error: 'Could not convert — the project has no board yet.' });
		return { ok: true };
	},

	archive: async ({ request, params, locals }) => {
		const id = String((await request.formData()).get('id') ?? '');
		const { fail: f } = await requireOwned(locals, params.wsSlug, params.projectSlug, id);
		if (f) return f;
		await archiveSuggestion(id);
		return { ok: true };
	},

	unarchive: async ({ request, params, locals }) => {
		const id = String((await request.formData()).get('id') ?? '');
		const { fail: f } = await requireOwned(locals, params.wsSlug, params.projectSlug, id);
		if (f) return f;
		await unarchiveSuggestion(id);
		return { ok: true };
	}
};
