import { error, json } from '@sveltejs/kit';
import { requireBoardAccess, requireUser } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { createView, listViews, type ViewFilters } from '$lib/server/services/views';
import type { RequestHandler } from './$types';

/** Keep only the known, non-empty filter keys. */
function cleanFilters(input: unknown): ViewFilters {
	const f = (input ?? {}) as Record<string, unknown>;
	const out: ViewFilters = {};
	const q = String(f.q ?? '').trim();
	if (q) out.q = q;
	if (f.label) out.label = String(f.label);
	if (f.assignee) out.assignee = String(f.assignee);
	if (f.priority) out.priority = String(f.priority);
	return out;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals.user);
	await requireBoardAccess(locals.user, params.boardId);
	return json({ views: await listViews(params.boardId, user.id) });
};

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { access } = await requireBoardAccess(locals.user, params.boardId);

	const body = await request.json();
	const name = String(body.name ?? '').trim().slice(0, 80);
	if (!name) throw error(400, 'A name is required');
	// Only members (collaborator+) may publish a shared team view.
	const shared = body.shared === true && access.level >= ACCESS.COLLABORATOR;

	const id = await createView(params.boardId, user.id, {
		name,
		filters: cleanFilters(body.filters),
		shared
	});
	return json({ id, shared });
};
