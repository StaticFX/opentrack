import { error, json } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import { requireBoardAccess, requireUser } from '$lib/server/access';
import { db, schema } from '$lib/server/db';
import { enqueueTicketPush } from '$lib/server/github/enqueue';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { deleteTicket, moveTicket, setAssignee, setLabel } from '$lib/server/services/tickets';
import type { RequestHandler } from './$types';

const ACTIONS = ['move', 'label', 'assign', 'delete'] as const;
type Action = (typeof ACTIONS)[number];

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const body = await request.json();
	const action = String(body.action ?? '') as Action;
	if (!ACTIONS.includes(action)) throw error(400, 'Unknown action');

	// Delete needs maintainer; the rest need collaborator.
	const min = action === 'delete' ? ACCESS.MAINTAINER : ACCESS.COLLABORATOR;
	await requireBoardAccess(locals.user, params.boardId, min);

	const ids = (Array.isArray(body.ticketIds) ? body.ticketIds : []).map(String).slice(0, 200);
	if (!ids.length) throw error(400, 'No tickets selected');

	// Only operate on tickets that actually belong to this board.
	const rows = await db
		.select({ id: schema.tickets.id })
		.from(schema.tickets)
		.where(and(eq(schema.tickets.boardId, params.boardId), inArray(schema.tickets.id, ids)));
	const valid = rows.map((r) => r.id);
	if (!valid.length) throw error(400, 'No matching tickets');

	if (action === 'move') {
		const columnId = String(body.columnId ?? '');
		if (!columnId) throw error(400, 'columnId is required');
		// Ensure the column is on this board.
		const [col] = await db
			.select({ id: schema.boardColumns.id })
			.from(schema.boardColumns)
			.where(and(eq(schema.boardColumns.id, columnId), eq(schema.boardColumns.boardId, params.boardId)))
			.limit(1);
		if (!col) throw error(400, 'Invalid column');
		for (const id of valid) {
			await moveTicket(id, columnId);
			await enqueueTicketPush(id, user.id);
		}
	} else if (action === 'label') {
		const labelId = String(body.labelId ?? '');
		if (!labelId) throw error(400, 'labelId is required');
		for (const id of valid) await setLabel(id, labelId, true);
	} else if (action === 'assign') {
		const userId = String(body.userId ?? '');
		if (!userId) throw error(400, 'userId is required');
		for (const id of valid) await setAssignee(id, userId, true);
	} else if (action === 'delete') {
		for (const id of valid) await deleteTicket(id);
	}

	await boardEvent(params.boardId, action === 'delete' ? 'ticket.deleted' : 'ticket.moved', { bulk: true }, user.id);
	return json({ count: valid.length });
};
