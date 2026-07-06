import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { db, schema } from '$lib/server/db';
import { canManageProject } from '$lib/server/permissions';
import { ACCESS } from '$lib/server/permissions';
import { deleteUpload, readUpload } from '$lib/server/uploads';
import type { RequestHandler } from './$types';

async function loadAttachment(id: string) {
	const [row] = await db.select().from(schema.attachments).where(eq(schema.attachments.id, id)).limit(1);
	return row ?? null;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const att = await loadAttachment(params.id);
	if (!att) throw error(404, 'Not found');
	// Attachments inherit the ticket's visibility.
	if (att.ticketId) await requireTicketAccess(locals.user, att.ticketId);
	else throw error(404, 'Not found');

	let bytes: Buffer;
	try {
		bytes = await readUpload(att.storageKey);
	} catch {
		throw error(404, 'File missing');
	}
	const inline = att.mime.startsWith('image/') || att.mime === 'application/pdf';
	return new Response(new Uint8Array(bytes), {
		headers: {
			'content-type': att.mime,
			'content-length': String(bytes.length),
			'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${att.filename.replace(/"/g, '')}"`,
			'cache-control': 'private, max-age=31536000, immutable'
		}
	});
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals.user);
	const att = await loadAttachment(params.id);
	if (!att) throw error(404, 'Not found');
	if (!att.ticketId) throw error(404, 'Not found');

	// Uploader can always remove their own; otherwise require project management.
	if (att.uploaderId !== user.id) {
		const { access } = await requireTicketAccess(locals.user, att.ticketId, ACCESS.COLLABORATOR);
		if (!canManageProject(access.level)) throw error(403, 'Not allowed');
	} else {
		await requireTicketAccess(locals.user, att.ticketId, ACCESS.COLLABORATOR);
	}

	await db.delete(schema.attachments).where(eq(schema.attachments.id, params.id));
	await deleteUpload(att.storageKey);
	return json({ ok: true });
};
