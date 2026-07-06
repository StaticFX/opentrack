import '$lib/server/load-env';
import { eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { listBoards } from '$lib/server/services/boards';
import { createProject } from '$lib/server/services/projects';
import { createWorkspace } from '$lib/server/services/workspaces';
import { createView, deleteView, getView, listViews, updateView } from '$lib/server/services/views';

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
	const ws = await createWorkspace(alice, { name: 'Views WS' });
	const project = await createProject(alice, { ...ws }, { name: 'Views Proj' });
	const [board] = await listBoards(project.id);

	console.log('[1] create personal + shared views; filters roundtrip');
	const personal = await createView(board.id, alice.id, {
		name: 'My high-pri bugs',
		filters: { q: 'crash', label: 'lbl-1', priority: 'high' },
		shared: false
	});
	const teamView = await createView(board.id, alice.id, { name: 'Team open', filters: { priority: 'urgent' }, shared: true });
	await createView(board.id, bob.id, { name: "Bob's private", filters: { q: 'ui' }, shared: false });
	assert(!!personal && !!teamView, 'views created');

	console.log('[2] visibility: own + shared, never others’ personal');
	const aliceViews = await listViews(board.id, alice.id);
	assert(aliceViews.length === 2, `alice sees her 2 views (got ${aliceViews.length})`);
	assert(!aliceViews.some((v) => v.name === "Bob's private"), "alice cannot see bob's personal view");
	const bobViews = await listViews(board.id, bob.id);
	assert(bobViews.length === 2, `bob sees his own + the shared one (got ${bobViews.length})`);
	assert(bobViews.some((v) => v.name === 'Team open' && !v.mine), 'shared view visible to bob, flagged not-mine');
	assert(bobViews.some((v) => v.name === "Bob's private" && v.mine), "bob's own view flagged mine");

	console.log('[3] filters persisted verbatim');
	const my = aliceViews.find((v) => v.id === personal)!;
	assert(my.filters.q === 'crash' && my.filters.label === 'lbl-1' && my.filters.priority === 'high', 'filter object round-tripped');
	assert(my.filters.assignee === undefined, 'unset filter key stays absent');

	console.log('[4] getView (authz) + update (rename / filters / share toggle)');
	const owner = await getView(personal);
	assert(owner?.userId === alice.id && owner?.boardId === board.id, 'getView returns owner + board');
	await updateView(personal, { name: 'Renamed', filters: { assignee: bob.id }, shared: true });
	const after = (await listViews(board.id, alice.id)).find((v) => v.id === personal)!;
	assert(after.name === 'Renamed', 'rename applied');
	assert(after.shared === true, 'share toggle applied');
	assert(after.filters.assignee === bob.id && after.filters.q === undefined, 'filters replaced wholesale');
	// now that it's shared, bob sees 3
	assert((await listViews(board.id, bob.id)).length === 3, 'newly-shared view now visible to bob');

	console.log('[5] delete + cascade on board delete');
	await deleteView(teamView);
	assert(!(await listViews(board.id, alice.id)).some((v) => v.id === teamView), 'deleted view gone');
	// deleting the workspace cascades → project → board → board_views
	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	const [orphan] = await db.select().from(schema.boardViews).where(eq(schema.boardViews.id, personal));
	assert(!orphan, 'views cascade-deleted with the board');

	// cleanup
	for (const u of [alice, bob]) await db.delete(schema.users).where(eq(schema.users.id, u.id));

	console.log('\n✅ smoke-views passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-views failed:', err);
	await closeDb();
	process.exit(1);
});
