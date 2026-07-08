import { error, json, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { db, schema } from '$lib/server/db';
import { canManageProject } from '$lib/server/permissions';
import { ACCESS } from '$lib/server/permissions';
import { deleteUpload, readUpload, serveUrl, type StorageDriver } from '$lib/server/uploads';
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

	const driver = att.storageDriver as StorageDriver;
	const inline = att.mime.startsWith('image/') || att.mime === 'application/pdf';

	// S3-backed objects: hand the browser a short-lived presigned URL (offloads
	// bandwidth to the bucket; disposition/type are baked into the signature).
	if (driver === 's3') {
		let url: string | null;
		try {
			url = await serveUrl(driver, att.storageKey, { mime: att.mime, filename: att.filename, inline });
		} catch {
			throw error(404, 'File missing');
		}
		if (!url) throw error(404, 'File missing');
		throw redirect(302, url);
	}

	let bytes: Buffer;
	try {
		bytes = await readUpload(driver, att.storageKey);
	} catch {
		throw error(404, 'File missing');
	}
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
	await deleteUpload(att.storageDriver as StorageDriver, att.storageKey);
	return json({ ok: true });
};
