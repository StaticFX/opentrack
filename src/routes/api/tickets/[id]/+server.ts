import { error, json } from '@sveltejs/kit';
import type { Priority } from '$lib/constants';
import { PRIORITIES } from '$lib/constants';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { enqueueTicketPush } from '$lib/server/github/enqueue';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { listComments } from '$lib/server/services/comments';
import { deleteTicket, getTicketDetail, updateTicket } from '$lib/server/services/tickets';
import { hasVoted } from '$lib/server/services/votes';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { access } = await requireTicketAccess(locals.user, params.id);
	const detail = await getTicketDetail(params.id);
	if (!detail) throw error(404, 'Ticket not found');
	const comments = await listComments('ticket', params.id);
	const voted = locals.user ? await hasVoted('ticket', params.id, { userId: locals.user.id }) : false;
	return json({
		ticket: detail,
		comments,
		voted,
		access: {
			level: access.level,
			canEdit: access.level >= ACCESS.COLLABORATOR,
			canManage: access.level >= ACCESS.MAINTAINER
		}
	});
};

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { boardId } = await requireTicketAccess(locals.user, params.id, ACCESS.COLLABORATOR);
	const body = await request.json();

	await updateTicket(params.id, {
		...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
		...(body.description !== undefined ? { description: body.description || null } : {}),
		...(PRIORITIES.includes(body.priority) ? { priority: body.priority as Priority } : {}),
		...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {})
	});
	if (boardId) await boardEvent(boardId, 'ticket.updated', { ticketId: params.id }, user.id);
	await enqueueTicketPush(params.id);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals.user);
	const { boardId } = await requireTicketAccess(locals.user, params.id, ACCESS.MAINTAINER);
	await deleteTicket(params.id);
	if (boardId) await boardEvent(boardId, 'ticket.deleted', { ticketId: params.id }, user.id);
	return json({ ok: true });
};
