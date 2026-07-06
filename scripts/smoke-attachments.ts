import '$lib/server/load-env';
import { existsSync } from 'node:fs';
import { asc, eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import { deleteUpload, readUpload, saveUpload, sanitizeFilename, uploadPath, MAX_UPLOAD_BYTES } from '$lib/server/uploads';
import { listBoards } from '$lib/server/services/boards';
import { createProject } from '$lib/server/services/projects';
import { createWorkspace, deleteWorkspace } from '$lib/server/services/workspaces';
import type { SessionUser } from '$lib/server/auth/session';

function assert(c: unknown, m: string) {
	if (!c) throw new Error('FAIL: ' + m);
	console.log('  ✓ ' + m);
}

async function main() {
	console.log('[1] sanitizeFilename');
	const trav = sanitizeFilename('../../etc/passwd');
	assert(!trav.includes('/') && !trav.includes('\\') && !trav.startsWith('.'), 'strips path separators + leading dots');
	assert(sanitizeFilename('my file (1).PNG') === 'my_file__1_.PNG', 'non-safe chars replaced');
	assert(sanitizeFilename('') === 'file', 'empty → file');
	assert(MAX_UPLOAD_BYTES === 25 * 1024 * 1024, '25 MB cap');

	console.log('\n[2] saveUpload / readUpload / deleteUpload round-trip');
	const bytes = Buffer.from('hello attachment 世界', 'utf8');
	const key = await saveUpload('note.txt', bytes);
	assert(/^[0-9a-f-]{36}\/note\.txt$/.test(key), 'storage key = <uuid>/<safe-name>');
	assert(existsSync(uploadPath(key)), 'file written to disk');
	const read = await readUpload(key);
	assert(read.equals(bytes), 'read back identical bytes');
	await deleteUpload(key);
	assert(!existsSync(uploadPath(key)), 'deleteUpload removes the file');

	// ── DB row lifecycle + cascade ──
	const [user] = await db.insert(schema.users).values({ username: 'att-u', displayName: 'Att', email: 'att@e.com' }).returning();
	const su: SessionUser = { id: user.id, username: user.username, displayName: user.displayName, email: user.email, isAdmin: false, avatarUrl: null } as SessionUser;
	const ws = await createWorkspace(su, { name: 'AttWs', slug: 'att-ws-smoke' });
	const project = await createProject(su, ws, { name: 'AttP' });
	const [board] = await listBoards(project.id);
	const [col] = await db.select().from(schema.boardColumns).where(eq(schema.boardColumns.boardId, board.id)).orderBy(asc(schema.boardColumns.position)).limit(1);
	const [ticket] = await db.insert(schema.tickets).values({ projectId: project.id, boardId: board.id, columnId: col.id, number: 1, title: 'T', position: 'a0' }).returning();

	try {
		console.log('\n[3] attachment row on a ticket + cascade on ticket delete');
		const sk = await saveUpload('shot.png', Buffer.from([1, 2, 3]));
		const [att] = await db.insert(schema.attachments).values({
			projectId: project.id, ticketId: ticket.id, uploaderId: user.id,
			filename: 'shot.png', mime: 'image/png', size: 3, storageKey: sk
		}).returning();
		assert(att.id && att.ticketId === ticket.id, 'attachment row created for the ticket');

		// Deleting the ticket cascades the attachment row (bytes cleaned separately by the endpoint).
		await db.delete(schema.tickets).where(eq(schema.tickets.id, ticket.id));
		const after = await db.select().from(schema.attachments).where(eq(schema.attachments.id, att.id));
		assert(after.length === 0, 'attachment row cascade-deleted with its ticket');
		await deleteUpload(sk);

		console.log('\n[smoke-attachments] ✓ all checks passed');
	} finally {
		await deleteWorkspace(ws.id).catch(() => {});
		await db.delete(schema.users).where(eq(schema.users.id, user.id)).catch(() => {});
	}
	await closeDb();
}

main().catch(async (e) => {
	console.error(e);
	await closeDb();
	process.exit(1);
});
