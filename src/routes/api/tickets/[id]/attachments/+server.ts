import { error, json } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { db, schema } from '$lib/server/db';
import { boardEvent } from '$lib/server/realtime/board';
import { ACCESS } from '$lib/server/permissions';
import { MAX_UPLOAD_BYTES, saveUpload } from '$lib/server/uploads';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	await requireTicketAccess(locals.user, params.id);
	const rows = await db
		.select({
			id: schema.attachments.id,
			filename: schema.attachments.filename,
			mime: schema.attachments.mime,
			size: schema.attachments.size,
			createdAt: schema.attachments.createdAt
		})
		.from(schema.attachments)
		.where(eq(schema.attachments.ticketId, params.id))
		.orderBy(desc(schema.attachments.createdAt));
	return json({ attachments: rows.map((r) => ({ ...r, url: `/api/attachments/${r.id}` })) });
};

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { projectId, boardId } = await requireTicketAccess(locals.user, params.id, ACCESS.COLLABORATOR);

	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) throw error(400, 'No file provided');
	if (file.size === 0) throw error(400, 'Empty file');
	if (file.size > MAX_UPLOAD_BYTES) throw error(413, 'File exceeds 25 MB');

	const bytes = Buffer.from(await file.arrayBuffer());
	const mime = file.type || 'application/octet-stream';
	const { storageKey, driver } = await saveUpload(file.name || 'file', bytes, mime);

	const [row] = await db
		.insert(schema.attachments)
		.values({
			projectId,
			ticketId: params.id,
			uploaderId: user.id,
			filename: file.name || 'file',
			mime,
			size: file.size,
			storageKey,
			storageDriver: driver
		})
		.returning({ id: schema.attachments.id, filename: schema.attachments.filename, mime: schema.attachments.mime });

	if (boardId) await boardEvent(boardId, 'ticket.updated', { ticketId: params.id }, user.id);
	return json({ id: row.id, filename: row.filename, mime: row.mime, url: `/api/attachments/${row.id}` });
};
