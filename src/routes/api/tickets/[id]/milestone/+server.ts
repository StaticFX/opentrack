import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { db, schema } from '$lib/server/db';
import { enqueueTicketPush } from '$lib/server/github/enqueue';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { setTicketMilestone } from '$lib/server/services/milestones';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { boardId, projectId } = await requireTicketAccess(locals.user, params.id, ACCESS.COLLABORATOR);
	const body = await request.json();
	const milestoneId = body.milestoneId ? String(body.milestoneId) : null;

	// A milestone must belong to the same project as the ticket.
	if (milestoneId) {
		const [m] = await db
			.select({ id: schema.milestones.id })
			.from(schema.milestones)
			.where(and(eq(schema.milestones.id, milestoneId), eq(schema.milestones.projectId, projectId)))
			.limit(1);
		if (!m) throw error(400, 'Milestone not found in this project');
	}

	await setTicketMilestone(params.id, milestoneId);
	if (boardId) await boardEvent(boardId, 'ticket.updated', { ticketId: params.id }, user.id);
	await enqueueTicketPush(params.id);
	return json({ ok: true });
};
