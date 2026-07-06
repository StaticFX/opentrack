import { error, json } from '@sveltejs/kit';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { setLabel } from '$lib/server/services/tickets';
import { enqueueWorkflowEvent } from '$lib/server/services/workflow';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { boardId, projectId } = await requireTicketAccess(locals.user, params.id, ACCESS.COLLABORATOR);
	const body = await request.json();
	const labelId = String(body.labelId ?? '');
	if (!labelId) throw error(400, 'labelId is required');

	const add = body.add !== false;
	await setLabel(params.id, labelId, add);
	if (boardId) await boardEvent(boardId, 'ticket.updated', { ticketId: params.id }, user.id);
	if (add) await enqueueWorkflowEvent(projectId, 'ticket.labeled', params.id, { labelId });
	return json({ ok: true });
};
