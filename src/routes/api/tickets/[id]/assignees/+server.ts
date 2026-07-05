import { error, json } from '@sveltejs/kit';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { setAssignee } from '$lib/server/services/tickets';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { boardId } = await requireTicketAccess(locals.user, params.id, ACCESS.COLLABORATOR);
	const body = await request.json();
	const userId = String(body.userId ?? '');
	if (!userId) throw error(400, 'userId is required');

	await setAssignee(params.id, userId, body.add !== false);
	if (boardId) await boardEvent(boardId, 'ticket.updated', { ticketId: params.id }, user.id);
	return json({ ok: true });
};
