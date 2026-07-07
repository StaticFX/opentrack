import { json } from '@sveltejs/kit';
import { requireColumnAccess, requireUser } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { archiveColumn } from '$lib/server/services/tickets';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals.user);
	const { boardId } = await requireColumnAccess(locals.user, params.id, ACCESS.COLLABORATOR);
	const count = await archiveColumn(params.id);
	if (boardId) await boardEvent(boardId, 'ticket.updated', { columnId: params.id }, user.id);
	return json({ ok: true, count });
};
