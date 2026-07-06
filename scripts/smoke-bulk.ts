import '$lib/server/load-env';
import { and, eq, inArray } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { createLabel } from '$lib/server/services/labels';
import { createProject } from '$lib/server/services/projects';
import { createTicket, deleteTicket, listBoardTickets, moveTicket, setAssignee, setLabel } from '$lib/server/services/tickets';
import { createWorkspace } from '$lib/server/services/workspaces';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}

/** Mirror of the bulk endpoint's board-scoping guard. */
async function boardScopedIds(boardId: string, ids: string[]): Promise<string[]> {
	const rows = await db
		.select({ id: schema.tickets.id })
		.from(schema.tickets)
		.where(and(eq(schema.tickets.boardId, boardId), inArray(schema.tickets.id, ids)));
	return rows.map((r) => r.id);
}

async function main() {
	const [u] = await db.insert(schema.users).values({ username: `bulk-${Date.now()}`, displayName: 'Bulk' }).returning();
	const user: SessionUser = { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };
	const ws = await createWorkspace(user, { name: 'Bulk WS' });
	const project = await createProject(user, { ...ws }, { name: 'Bulk Proj' });
	const [board] = await listBoards(project.id);
	const cols = await getBoardColumns(board.id);
	const todo = cols.find((c) => c.category === 'todo')!;
	const done = cols.find((c) => c.category === 'done')!;
	const label = await createLabel(project.id, { name: 'triage', color: '#f59e0b' });

	const t1 = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: todo.id, title: 'A' });
	const t2 = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: todo.id, title: 'B' });
	const t3 = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: todo.id, title: 'C' });

	// A ticket on a DIFFERENT board (must never be touched by bulk).
	const otherProj = await createProject(user, { ...ws }, { name: 'Other' });
	const [otherBoard] = await listBoards(otherProj.id);
	const otherTodo = (await getBoardColumns(otherBoard.id)).find((c) => c.category === 'todo')!;
	const foreign = await createTicket(user, { projectId: otherProj.id, boardId: otherBoard.id, columnId: otherTodo.id, title: 'Foreign' });

	console.log('[1] board-scoping drops tickets from other boards');
	const scoped = await boardScopedIds(board.id, [t1.id, t2.id, t3.id, foreign.id]);
	assert(scoped.length === 3 && !scoped.includes(foreign.id), 'foreign ticket excluded from the operation set');

	console.log('[2] bulk move → column + closedAt set for done');
	for (const id of scoped) await moveTicket(id, done.id);
	let cards = await listBoardTickets(board.id);
	assert(cards.every((c) => c.columnId === done.id), 'all moved to Done');
	const rows = await db.select({ closedAt: schema.tickets.closedAt }).from(schema.tickets).where(inArray(schema.tickets.id, scoped));
	assert(rows.every((r) => r.closedAt != null), 'moving to a done column stamps closedAt');

	console.log('[3] bulk label + assign apply to all');
	for (const id of scoped) { await setLabel(id, label.id, true); await setAssignee(id, user.id, true); }
	cards = await listBoardTickets(board.id);
	assert(cards.every((c) => c.labels.some((l) => l.id === label.id)), 'label added to every ticket');
	const assignRows = await db.select().from(schema.ticketAssignees).where(inArray(schema.ticketAssignees.ticketId, scoped));
	assert(assignRows.length === 3, 'assignee added to every ticket');

	console.log('[4] bulk delete removes only the targeted board tickets');
	for (const id of [t1.id, t2.id]) await deleteTicket(id);
	cards = await listBoardTickets(board.id);
	assert(cards.length === 1 && cards[0].id === t3.id, 'two deleted, one remains');
	const [foreignStill] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, foreign.id));
	assert(!!foreignStill, 'foreign ticket untouched throughout');

	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	await db.delete(schema.users).where(eq(schema.users.id, user.id));

	console.log('\n✅ smoke-bulk passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-bulk failed:', err);
	await closeDb();
	process.exit(1);
});
