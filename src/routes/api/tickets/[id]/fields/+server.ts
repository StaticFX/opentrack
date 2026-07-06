import { error, json } from '@sveltejs/kit';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { getTicketFields, listFields, setTicketFieldValue } from '$lib/server/services/custom-fields';
import type { RequestHandler } from './$types';

/** Validate + normalize a raw value for a field type. Returns '' to clear. */
function normalize(type: string, raw: unknown, options: string[] | null): string {
	const s = String(raw ?? '').trim();
	if (s === '') return '';
	switch (type) {
		case 'number':
			if (!Number.isFinite(Number(s))) throw error(400, 'Value must be a number');
			return String(Number(s));
		case 'checkbox':
			return s === 'true' || s === '1' ? 'true' : 'false';
		case 'date': {
			const d = new Date(s);
			if (Number.isNaN(d.getTime())) throw error(400, 'Invalid date');
			return s;
		}
		case 'select':
			if (!(options ?? []).includes(s)) throw error(400, 'Value is not a valid option');
			return s;
		default:
			return s.slice(0, 2000);
	}
}

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { access, boardId } = await requireTicketAccess(locals.user, params.id, ACCESS.COLLABORATOR);
	const body = await request.json();
	const fieldId = String(body.fieldId ?? '');
	if (!fieldId) throw error(400, 'fieldId is required');

	const field = (await listFields(access.project.id)).find((f) => f.id === fieldId);
	if (!field) throw error(404, 'Field not found on this project');

	const value = normalize(field.type, body.value, field.options);
	await setTicketFieldValue(params.id, fieldId, value || null);
	if (boardId) await boardEvent(boardId, 'ticket.updated', { ticketId: params.id }, user.id);
	return json({ fields: await getTicketFields(params.id, access.project.id) });
};
