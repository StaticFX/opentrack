import { error, json } from '@sveltejs/kit';
import { requireBoardAccess, requireUser } from '$lib/server/access';
import type { SessionUser } from '$lib/server/auth/session';
import { ACCESS } from '$lib/server/permissions';
import { deleteView, getView, sanitizeFilters, updateView, type ViewFilters } from '$lib/server/services/views';
import type { RequestHandler } from './$types';

/** The owner, or a board maintainer, may modify a view. */
async function authorize(user: SessionUser, viewId: string) {
	const view = await getView(viewId);
	if (!view) throw error(404, 'View not found');
	const { access } = await requireBoardAccess(user, view.boardId);
	if (view.userId !== user.id && access.level < ACCESS.MAINTAINER) {
		throw error(403, 'You cannot modify this view.');
	}
	return { view, access };
}

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { access } = await authorize(user, params.id);
	const body = await request.json();
	const patch: { name?: string; filters?: ViewFilters; shared?: boolean } = {};
	if (typeof body.name === 'string') {
		const name = body.name.trim().slice(0, 80);
		if (!name) throw error(400, 'A name is required');
		patch.name = name;
	}
	if (body.filters !== undefined) patch.filters = sanitizeFilters(body.filters);
	if (body.shared !== undefined) {
		patch.shared = body.shared === true && access.level >= ACCESS.COLLABORATOR;
	}
	await updateView(params.id, patch);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals.user);
	await authorize(user, params.id);
	await deleteView(params.id);
	return json({ ok: true });
};
