import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { CLOSED_CATEGORIES } from '$lib/constants';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { db, schema } from '$lib/server/db';
import { enqueueTicketPush } from '$lib/server/github/enqueue';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { enqueueDiscordForSubject } from '$lib/server/discord/enqueue';
import { logActivity } from '$lib/server/services/activity';
import { notifyWatchers } from '$lib/server/services/notifications';
import { moveTicket } from '$lib/server/services/tickets';
import { enqueueWorkflowEvent } from '$lib/server/services/workflow';
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
		await enqueueWorkflowEvent(projectId, 'ticket.moved', params.id, { columnName: col.name });
		const closed = CLOSED_CATEGORIES.includes(col.category as never);
		await logActivity({
			projectId,
			subjectType: 'ticket',
			subjectId: params.id,
			actorId: user.id,
			type: closed ? 'ticket.closed' : 'ticket.moved',
			data: { column: col.name }
		});
		if (closed) {
			await notifyWatchers({
				type: 'ticket.closed',
				subjectType: 'ticket',
				subjectId: params.id,
				actorId: user.id,
				body: `${user.displayName} closed this (${col.name})`
			});
			await enqueueDiscordForSubject(projectId, 'ticket.closed', 'ticket', params.id, {
				actor: user.displayName,
				fields: [{ name: 'Column', value: col.name }]
			});
		} else {
			// A non-closing move is still activity watchers care about.
			await notifyWatchers({
				type: 'ticket.updated',
				subjectType: 'ticket',
				subjectId: params.id,
				actorId: user.id,
				body: `${user.displayName} moved this to ${col.name}`
			});
		}
	}
	return json({ ok: true });
};
