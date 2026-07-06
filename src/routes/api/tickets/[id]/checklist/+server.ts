import { error, json } from '@sveltejs/kit';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { addChecklistItem, listChecklist } from '$lib/server/services/checklists';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	await requireTicketAccess(locals.user, params.id);
	return json({ checklist: await listChecklist(params.id) });
};

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { boardId } = await requireTicketAccess(locals.user, params.id, ACCESS.COLLABORATOR);
	const text = String((await request.json()).text ?? '').trim().slice(0, 500);
	if (!text) throw error(400, 'Text is required');
	const item = await addChecklistItem(params.id, text);
	if (boardId) await boardEvent(boardId, 'ticket.updated', { ticketId: params.id }, user.id);
	return json({ item });
};
