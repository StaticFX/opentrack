import { error, json } from '@sveltejs/kit';
import type { ColumnCategory } from '$lib/constants';
import { COLUMN_CATEGORIES } from '$lib/constants';
import { requireBoardAccess, requireUser } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { createColumn } from '$lib/server/services/columns';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	await requireBoardAccess(locals.user, params.boardId, ACCESS.MAINTAINER);
	const body = await request.json();
	const name = String(body.name ?? '').trim();
	if (!name) throw error(400, 'Column name is required');
	const category = (COLUMN_CATEGORIES.includes(body.category) ? body.category : 'todo') as ColumnCategory;

	const col = await createColumn(params.boardId, {
		name,
		color: typeof body.color === 'string' ? body.color : undefined,
		icon: typeof body.icon === 'string' ? body.icon : undefined,
		category
	});
	await boardEvent(params.boardId, 'column.created', { columnId: col.id }, user.id);
	return json({ id: col.id });
};
