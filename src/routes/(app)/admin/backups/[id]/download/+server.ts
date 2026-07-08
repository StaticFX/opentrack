import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { readBackupBytes } from '$lib/server/backup/service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user?.isAdmin) throw error(403, 'Admins only');
	const [row] = await db.select().from(schema.backups).where(eq(schema.backups.id, params.id)).limit(1);
	if (!row || row.status !== 'ok') throw error(404, 'Backup not found');

	let bytes: Buffer;
	try {
		bytes = await readBackupBytes(row);
	} catch {
		throw error(404, 'Backup file missing');
	}
	return new Response(new Uint8Array(bytes), {
		headers: {
			'content-type': 'application/x-sqlite3',
			'content-length': String(bytes.length),
			'content-disposition': `attachment; filename="${row.filename.replace(/"/g, '')}"`
		}
	});
};
