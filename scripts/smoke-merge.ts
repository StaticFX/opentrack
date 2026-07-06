import '$lib/server/load-env';
import { eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { listWatchers, watch } from '$lib/server/services/notifications';
import { createProject } from '$lib/server/services/projects';
import {
	createSuggestion,
	getSuggestion,
	mergeSuggestion,
	searchSuggestions
} from '$lib/server/services/suggestions';
import { countVotes, toggleVote } from '$lib/server/services/votes';
import { createWorkspace } from '$lib/server/services/workspaces';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}

async function mkUser(name: string): Promise<SessionUser> {
	const [u] = await db.insert(schema.users).values({ username: `${name}-${Date.now()}-${Math.floor(performance.now())}`, displayName: name }).returning();
	return { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };
}

async function main() {
	const alice = await mkUser('alice');
	const bob = await mkUser('bob');
	const carol = await mkUser('carol');
	const ws = await createWorkspace(alice, { name: 'Merge WS' });
	const project = await createProject(alice, { ...ws }, { name: 'Merge Proj' });

	const target = await createSuggestion(alice, project.id, { title: 'Canonical: dark mode' });
	const source = await createSuggestion(alice, project.id, { title: 'Please add dark theme' });

	// Votes: bob+carol on source, bob already on target (dedup check).
	await toggleVote('suggestion', source, { userId: bob.id });
	await toggleVote('suggestion', source, { userId: carol.id });
	await toggleVote('suggestion', target, { userId: bob.id });
	// Watcher on source.
	await watch('suggestion', source, carol.id, 'author');

	console.log('[1] search picker finds the target, excludes self');
	const found = await searchSuggestions(project.id, 'canonical', source);
	assert(found.some((r) => r.id === target), 'search finds target by title');
	const self = await searchSuggestions(project.id, 'dark theme', source);
	assert(!self.some((r) => r.id === source), 'exclude removes the source itself');

	console.log('[2] merge transfers votes (deduped) + watchers, marks duplicate');
	const res = await mergeSuggestion(source, target);
	assert(res?.targetTitle === 'Canonical: dark mode', 'merge returns titles');
	assert((await countVotes('suggestion', target)) === 2, 'target now has 2 votes (bob deduped)');
	assert((await listWatchers('suggestion', target)).includes(carol.id), 'carol now watches the target');
	const src = await getSuggestion(source);
	assert(src?.status === 'duplicate', 'source marked duplicate');
	assert(src?.duplicateOfId === target, 'source points at canonical target');
	assert(src?.duplicateOfTitle === 'Canonical: dark mode', 'getSuggestion resolves duplicate target title');

	console.log('[3] invalid merges rejected');
	assert((await mergeSuggestion(target, target)) === null, 'cannot merge into itself');
	const otherWs = await createWorkspace(bob, { name: 'Other WS' });
	const otherProj = await createProject(bob, { ...otherWs }, { name: 'Other' });
	const foreign = await createSuggestion(bob, otherProj.id, { title: 'foreign' });
	assert((await mergeSuggestion(source, foreign)) === null, 'cannot merge across projects');

	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, otherWs.id));
	for (const u of [alice, bob, carol]) await db.delete(schema.users).where(eq(schema.users.id, u.id));

	console.log('\n✅ smoke-merge passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-merge failed:', err);
	await closeDb();
	process.exit(1);
});
