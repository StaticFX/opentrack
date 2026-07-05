import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RelationType } from '$lib/constants';
import { RELATION_TYPES } from '$lib/constants';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { db, schema } from '$lib/server/db';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { addRelation, removeRelation } from '$lib/server/services/tickets';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { boardId, projectId } = await requireTicketAccess(locals.user, params.id, ACCESS.COLLABORATOR);
	const body = await request.json();
	const type = body.type as RelationType;
	if (!RELATION_TYPES.includes(type)) throw error(400, 'Invalid relation type');

	// Resolve the target by its per-project ticket number.
	let targetTicketId = String(body.targetTicketId ?? '');
	if (!targetTicketId && body.targetNumber) {
		const [target] = await db
			.select({ id: schema.tickets.id })
			.from(schema.tickets)
			.where(
				and(
					eq(schema.tickets.projectId, projectId),
					eq(schema.tickets.number, Number(body.targetNumber))
				)
			)
			.limit(1);
		if (!target) throw error(404, `No ticket #${body.targetNumber} in this project`);
		targetTicketId = target.id;
	}
	if (!targetTicketId) throw error(400, 'Target ticket is required');

	await addRelation(params.id, targetTicketId, type);
	if (boardId) await boardEvent(boardId, 'ticket.updated', { ticketId: params.id }, user.id);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { boardId } = await requireTicketAccess(locals.user, params.id, ACCESS.COLLABORATOR);
	const body = await request.json();
	const relationId = String(body.relationId ?? '');
	if (!relationId) throw error(400, 'relationId is required');

	await removeRelation(relationId);
	if (boardId) await boardEvent(boardId, 'ticket.updated', { ticketId: params.id }, user.id);
	return json({ ok: true });
};
