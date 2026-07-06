import { json } from '@sveltejs/kit';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { setArchived } from '$lib/server/services/tickets';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { boardId } = await requireTicketAccess(locals.user, params.id, ACCESS.COLLABORATOR);
	const archived = (await request.json()).archived !== false;
	await setArchived(params.id, archived);
	// A board reload drops archived tickets from the default view (or shows them when toggled on).
	if (boardId) await boardEvent(boardId, 'ticket.updated', { ticketId: params.id }, user.id);
	return json({ ok: true });
};
