import { error, json } from '@sveltejs/kit';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import {
	checklistItemTicket,
	deleteChecklistItem,
	updateChecklistItem
} from '$lib/server/services/checklists';
import type { RequestHandler } from './$types';

async function guard(user: App.Locals['user'], itemId: string) {
	const ticketId = await checklistItemTicket(itemId);
	if (!ticketId) throw error(404, 'Not found');
	const { boardId } = await requireTicketAccess(user, ticketId, ACCESS.COLLABORATOR);
	return { ticketId, boardId };
}

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { ticketId, boardId } = await guard(locals.user, params.itemId);
	const body = await request.json();
	const patch: { text?: string; done?: boolean } = {};
	if (typeof body.text === 'string') {
		const text = body.text.trim().slice(0, 500);
		if (!text) throw error(400, 'Text is required');
		patch.text = text;
	}
	if (typeof body.done === 'boolean') patch.done = body.done;
	await updateChecklistItem(params.itemId, patch);
	if (boardId) await boardEvent(boardId, 'ticket.updated', { ticketId }, user.id);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals.user);
	const { ticketId, boardId } = await guard(locals.user, params.itemId);
	await deleteChecklistItem(params.itemId);
	if (boardId) await boardEvent(boardId, 'ticket.updated', { ticketId }, user.id);
	return json({ ok: true });
};
