import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { CLOSED_CATEGORIES } from '$lib/constants';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { db, schema } from '$lib/server/db';
import { enqueueTicketPush } from '$lib/server/github/enqueue';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { logActivity } from '$lib/server/services/activity';
import { moveTicket } from '$lib/server/services/tickets';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { boardId, projectId } = await requireTicketAccess(locals.user, params.id, ACCESS.COLLABORATOR);

	const body = await request.json();
	const columnId = String(body.columnId ?? '');
	const position = body.position ? String(body.position) : undefined;
	if (!columnId) throw error(400, 'columnId is required');

	await moveTicket(params.id, columnId, position);
	if (boardId) await boardEvent(boardId, 'ticket.moved', { ticketId: params.id }, user.id);
	await enqueueTicketPush(params.id);

	const [col] = await db
		.select({ name: schema.boardColumns.name, category: schema.boardColumns.category })
		.from(schema.boardColumns)
		.where(eq(schema.boardColumns.id, columnId))
		.limit(1);
	if (col) {
		const closed = CLOSED_CATEGORIES.includes(col.category as never);
		await logActivity({
			projectId,
			subjectType: 'ticket',
			subjectId: params.id,
			actorId: user.id,
			type: closed ? 'ticket.closed' : 'ticket.moved',
			data: { column: col.name }
		});
	}
	return json({ ok: true });
};
