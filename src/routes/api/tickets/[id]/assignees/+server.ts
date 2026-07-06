import { error, json } from '@sveltejs/kit';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { enqueueTicketPush } from '$lib/server/github/enqueue';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { notifyUsers, watch } from '$lib/server/services/notifications';
import { setAssignee } from '$lib/server/services/tickets';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { boardId } = await requireTicketAccess(locals.user, params.id, ACCESS.COLLABORATOR);
	const body = await request.json();
	const userId = String(body.userId ?? '');
	if (!userId) throw error(400, 'userId is required');

	const add = body.add !== false;
	await setAssignee(params.id, userId, add);
	if (boardId) await boardEvent(boardId, 'ticket.updated', { ticketId: params.id }, user.id);
	// Mirror the assignment to the linked GitHub issue (no-op if unlinked).
	await enqueueTicketPush(params.id);

	// A newly-assigned user starts watching and is notified (unless self-assigning).
	if (add) {
		await watch('ticket', params.id, userId, 'assignee');
		if (userId !== user.id) {
			await notifyUsers([userId], {
				type: 'ticket.assigned',
				subjectType: 'ticket',
				subjectId: params.id,
				actorId: user.id,
				body: `${user.displayName} assigned this to you`
			});
		}
	}
	return json({ ok: true });
};
