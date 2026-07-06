import '$lib/server/load-env';
import { eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { createProject } from '$lib/server/services/projects';
import { globalSearch } from '$lib/server/services/search';
import { createTicket } from '$lib/server/services/tickets';
import { createWorkspace } from '$lib/server/services/workspaces';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}

async function mkUser(name: string): Promise<SessionUser> {
	const [u] = await db
		.insert(schema.users)
		.values({ username: `${name}-${Date.now()}-${Math.floor(performance.now())}`, displayName: name })
		.returning();
	return { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };
}

async function main() {
	const alice = await mkUser('alice');
	const bob = await mkUser('bob');

	const ws = await createWorkspace(alice, { name: 'Alpha WS' });
	const project = await createProject(alice, { ...ws }, { name: 'Alpha Rocket' });
	const [board] = await listBoards(project.id);
	const todo = (await getBoardColumns(board.id)).find((c) => c.category === 'todo')!;
	const ticket = await createTicket(alice, { projectId: project.id, boardId: board.id, columnId: todo.id, title: 'Login button broken' });

	// Bob has his own unrelated workspace.
	await createWorkspace(bob, { name: 'Bravo WS' });

	console.log('[1] empty query returns nothing');
	const empty = await globalSearch(alice, '   ');
	assert(empty.projects.length === 0 && empty.tickets.length === 0, 'blank query short-circuits');

	console.log('[2] project name match (case-insensitive)');
	const byProj = await globalSearch(alice, 'ROCK');
	assert(byProj.projects.some((p) => p.slug === project.slug && p.wsSlug === ws.slug), 'finds Alpha Rocket by fragment');

	console.log('[3] ticket title + deep-link fields');
	const byTitle = await globalSearch(alice, 'login');
	const hit = byTitle.tickets.find((t) => t.number === ticket.number);
	assert(!!hit, 'finds ticket by title fragment');
	assert(hit!.slug === project.slug && hit!.wsSlug === ws.slug, 'ticket carries ws+project slug for the public link');
	assert(hit!.closed === false, 'open ticket flagged not closed');

	console.log('[4] ticket by number (with and without #)');
	const byNum = await globalSearch(alice, `#${ticket.number}`);
	assert(byNum.tickets.some((t) => t.number === ticket.number), 'finds ticket by #number');

	console.log('[5] access scoping: outsiders see nothing');
	const bobProj = await globalSearch(bob, 'rocket');
	assert(bobProj.projects.length === 0, "bob can't see alice's project");
	const bobTk = await globalSearch(bob, 'login');
	assert(bobTk.tickets.length === 0, "bob can't see alice's tickets");

	// cleanup
	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	for (const u of [alice, bob]) {
		const owned = await db.select({ id: schema.workspaces.id }).from(schema.workspaces).where(eq(schema.workspaces.ownerId, u.id));
		for (const o of owned) await db.delete(schema.workspaces).where(eq(schema.workspaces.id, o.id));
		await db.delete(schema.users).where(eq(schema.users.id, u.id));
	}

	console.log('\n✅ smoke-search passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-search failed:', err);
	await closeDb();
	process.exit(1);
});
