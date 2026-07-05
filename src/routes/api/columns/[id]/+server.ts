import { error, json } from '@sveltejs/kit';
import type { ColumnCategory } from '$lib/constants';
import { COLUMN_CATEGORIES } from '$lib/constants';
import { requireColumnAccess, requireUser } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { deleteColumn, updateColumn } from '$lib/server/services/columns';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { boardId } = await requireColumnAccess(locals.user, params.id, ACCESS.MAINTAINER);
	const body = await request.json();

	await updateColumn(params.id, {
		...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
		...(typeof body.color === 'string' ? { color: body.color } : {}),
		...(body.icon !== undefined ? { icon: body.icon || null } : {}),
		...(COLUMN_CATEGORIES.includes(body.category) ? { category: body.category as ColumnCategory } : {}),
		...(body.wipLimit !== undefined ? { wipLimit: body.wipLimit === null ? null : Number(body.wipLimit) } : {}),
		...(typeof body.position === 'string' ? { position: body.position } : {})
	});
	await boardEvent(boardId, 'column.updated', { columnId: params.id }, user.id);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals.user);
	const { boardId } = await requireColumnAccess(locals.user, params.id, ACCESS.MAINTAINER);
	const ok = await deleteColumn(boardId, params.id);
	if (!ok) throw error(400, 'A board must keep at least one column.');
	await boardEvent(boardId, 'column.deleted', { columnId: params.id }, user.id);
	return json({ ok: true });
};
