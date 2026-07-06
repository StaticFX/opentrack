import '$lib/server/load-env';
import { asc, eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import { listBoardTickets, setArchived } from '$lib/server/services/tickets';
import { changelogSvg, roadmapSvg } from '$lib/server/embed-svg';
import { listBoards } from '$lib/server/services/boards';
import { createProject } from '$lib/server/services/projects';
import { createWorkspace, deleteWorkspace } from '$lib/server/services/workspaces';
import type { SessionUser } from '$lib/server/auth/session';

function assert(c: unknown, m: string) {
	if (!c) throw new Error('FAIL: ' + m);
	console.log('  ✓ ' + m);
}

async function main() {
	console.log('[1] embed SVG builders (pure)');
	const rm = roadmapSvg('Acme & Co <test>', [
		{ key: 'planned', title: 'Planned', count: 2, items: [{ number: 1, title: 'A', votes: 0, comments: 0, labels: [] }] },
		{ key: 'in_progress', title: 'In Progress', count: 0, items: [] },
		{ key: 'shipped', title: 'Shipped', count: 1, items: [{ number: 2, title: 'B', votes: 3, comments: 1, labels: [] }] }
	]);
	assert(rm.startsWith('<svg') && rm.includes('</svg>'), 'roadmap SVG well-formed');
	assert(rm.includes('Acme &amp; Co &lt;test&gt;'), 'roadmap XML-escapes the project name');
	assert(rm.includes('Powered by OpenTrack'), 'roadmap has footer');
	const cl = changelogSvg('Proj', [{ version: 'v1.0', name: 'First', releasedAt: new Date('2026-01-02T00:00:00Z') }]);
	assert(cl.startsWith('<svg') && cl.includes('v1.0') && cl.includes('2026-01-02'), 'changelog SVG has version + date');
	assert(changelogSvg('Empty', []).includes('No releases yet'), 'empty changelog handled');

	// ── archive filtering ──
	const [user] = await db.insert(schema.users).values({ username: 'qol-u', displayName: 'Q', email: 'qol@e.com' }).returning();
	const su: SessionUser = { id: user.id, username: user.username, displayName: user.displayName, email: user.email, isAdmin: false, avatarUrl: null } as SessionUser;
	const ws = await createWorkspace(su, { name: 'QolWs', slug: 'qol-ws-smoke' });
	const project = await createProject(su, ws, { name: 'QolP' });
	const [board] = await listBoards(project.id);
	const [col] = await db.select().from(schema.boardColumns).where(eq(schema.boardColumns.boardId, board.id)).orderBy(asc(schema.boardColumns.position)).limit(1);

	try {
		console.log('\n[2] archive hides a ticket from the board; toggle brings it back');
		const [a] = await db.insert(schema.tickets).values({ projectId: project.id, boardId: board.id, columnId: col.id, number: 1, title: 'Keep', position: 'a1' }).returning();
		const [b] = await db.insert(schema.tickets).values({ projectId: project.id, boardId: board.id, columnId: col.id, number: 2, title: 'Archive me', position: 'a2' }).returning();

		let cards = await listBoardTickets(board.id);
		assert(cards.length === 2, 'both tickets on the board initially');
		assert(cards.every((c) => c.archived === false), 'cards expose archived=false');

		await setArchived(b.id, true);
		cards = await listBoardTickets(board.id);
		assert(cards.length === 1 && cards[0].id === a.id, 'archived ticket excluded from the default board');

		const withArchived = await listBoardTickets(board.id, true);
		assert(withArchived.length === 2, 'includeArchived=true shows it again');
		assert(withArchived.find((c) => c.id === b.id)?.archived === true, 'restored card marked archived');

		await setArchived(b.id, false);
		cards = await listBoardTickets(board.id);
		assert(cards.length === 2, 'un-archiving restores it to the default board');

		console.log('\n[smoke-qol] ✓ all checks passed');
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
