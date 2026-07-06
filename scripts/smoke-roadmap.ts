import '$lib/server/load-env';
import { eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { buildRoadmapLanes } from '$lib/roadmap';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { createProject } from '$lib/server/services/projects';
import { createTicket, moveTicket } from '$lib/server/services/tickets';
import { toggleVote } from '$lib/server/services/votes';
import { createWorkspace } from '$lib/server/services/workspaces';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}

async function main() {
	const [u] = await db
		.insert(schema.users)
		.values({ username: `road-${Date.now()}`, displayName: 'Roader' })
		.returning();
	const user: SessionUser = { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };

	const ws = await createWorkspace(user, { name: 'Road WS' });
	const project = await createProject(user, { ...ws }, { name: 'Road Proj' });
	const [board] = await listBoards(project.id);
	const cols = await getBoardColumns(board.id);
	const backlog = cols.find((c) => c.category === 'backlog')!;
	const todo = cols.find((c) => c.category === 'todo')!;
	const prog = cols.find((c) => c.category === 'in_progress')!;
	const done = cols.find((c) => c.category === 'done')!;

	// Spread tickets across categories.
	const tBacklog = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: backlog.id, title: 'Backlog idea' });
	const tPlan1 = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: todo.id, title: 'Planned A' });
	const tPlan2 = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: todo.id, title: 'Planned B (popular)' });
	const tProg = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: prog.id, title: 'Working on it' });
	const tShip1 = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: done.id, title: 'Shipped older' });
	const tShip2 = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: done.id, title: 'Shipped newer' });
	// Give Planned B more votes so it should sort to the top of its lane.
	await toggleVote('ticket', tPlan2.id, { userId: user.id });

	// A private ticket in Todo must be excluded from the public roadmap.
	const tPriv = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: todo.id, title: 'Secret plan' });
	await db.update(schema.tickets).set({ visibility: 'private' }).where(eq(schema.tickets.id, tPriv.id));

	const columns = await getBoardColumns(board.id);
	const tickets = await (await import('$lib/server/services/tickets')).listBoardTickets(board.id);

	console.log('[1] lanes derived from column categories');
	const lanes = buildRoadmapLanes(columns, tickets, true);
	const byKey = Object.fromEntries(lanes.map((l) => [l.key, l]));
	assert(lanes.map((l) => l.key).join(',') === 'planned,in_progress,shipped', 'three lanes in order');
	assert(byKey.planned.items.some((t) => t.number === tPlan1.number), 'todo ticket → Planned');
	assert(byKey.in_progress.items.some((t) => t.number === tProg.number), 'in_progress ticket → In Progress');
	assert(byKey.shipped.items.some((t) => t.number === tShip1.number), 'done ticket → Shipped');

	console.log('[2] backlog + canceled excluded');
	const allNumbers = lanes.flatMap((l) => l.items.map((t) => t.number));
	assert(!allNumbers.includes(tBacklog.number), 'backlog ticket not on the roadmap');

	console.log('[3] private tickets excluded even when public');
	assert(!allNumbers.includes(tPriv.number), 'private ticket hidden from public roadmap');

	console.log('[4] planned sorted by votes desc');
	assert(byKey.planned.items[0].number === tPlan2.number, 'most-upvoted planned item is first');

	console.log('[5] shipped sorted most-recent (highest number) first');
	assert(byKey.shipped.items[0].number === tShip2.number, 'newest shipped first');

	console.log('[6] non-public project yields empty lanes');
	const privateLanes = buildRoadmapLanes(columns, tickets, false);
	assert(privateLanes.every((l) => l.count === 0), 'nothing shown when project is not public');

	// cleanup
	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	await db.delete(schema.users).where(eq(schema.users.id, user.id));

	console.log('\n✅ smoke-roadmap passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-roadmap failed:', err);
	await closeDb();
	process.exit(1);
});
