import { error, json } from '@sveltejs/kit';
import type { Priority } from '$lib/constants';
import { PRIORITIES } from '$lib/constants';
import { requireBoardAccess, requireUser } from '$lib/server/access';
import { enqueueTicketPush } from '$lib/server/github/enqueue';
import { ACCESS } from '$lib/server/permissions';
import { logActivity } from '$lib/server/services/activity';
import { boardEvent } from '$lib/server/realtime/board';
import { createTicket } from '$lib/server/services/tickets';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { projectId } = await requireBoardAccess(locals.user, params.boardId, ACCESS.COLLABORATOR);

	const body = await request.json();
	const title = String(body.title ?? '').trim();
	const columnId = String(body.columnId ?? '');
	if (!title) throw error(400, 'Title is required');
	if (!columnId) throw error(400, 'Column is required');
	const priority = (PRIORITIES.includes(body.priority) ? body.priority : 'none') as Priority;

	const ticket = await createTicket(user, {
		projectId,
		boardId: params.boardId,
		columnId,
		title,
		description: typeof body.description === 'string' ? body.description : undefined,
		priority
	});
	await boardEvent(params.boardId, 'ticket.created', { ticketId: ticket.id }, user.id);
	await enqueueTicketPush(ticket.id);
	await logActivity({ projectId, subjectType: 'ticket', subjectId: ticket.id, actorId: user.id, type: 'ticket.created' });
	return json({ id: ticket.id, number: ticket.number });
};
