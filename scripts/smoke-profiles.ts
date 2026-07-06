import '$lib/server/load-env';
import { eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { getPublicProfile } from '$lib/server/services/profiles';
import { createProject } from '$lib/server/services/projects';
import { createSuggestion, setStatus } from '$lib/server/services/suggestions';
import { toggleVote } from '$lib/server/services/votes';
import { createWorkspace } from '$lib/server/services/workspaces';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}
async function mkUser(name: string): Promise<SessionUser> {
	const [u] = await db.insert(schema.users).values({ username: `${name}${Date.now()}`, displayName: name }).returning();
	return { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };
}

async function main() {
	const alice = await mkUser('Alice');
	const bob = await mkUser('Bob');

	const pubWs = await createWorkspace(alice, { name: 'Public WS' });
	const p1 = await createProject(alice, { ...pubWs }, { name: 'Public Proj' });
	const privWs = await createWorkspace(alice, { name: 'Private WS' });
	await db.update(schema.workspaces).set({ visibility: 'private' }).where(eq(schema.workspaces.id, privWs.id));
	const p2 = await createProject(alice, { ...privWs }, { name: 'Secret Proj' });

	const s1 = await createSuggestion(alice, p1.id, { title: 'Public A' });
	await setStatus(s1, 'accepted');
	const s2 = await createSuggestion(alice, p1.id, { title: 'Public B' });
	await createSuggestion(alice, p2.id, { title: 'Private one' });
	await toggleVote('suggestion', s2, { userId: bob.id });

	console.log('[1] stats count only public contributions');
	const prof = await getPublicProfile(alice.username);
	assert(!!prof, 'profile resolves for an active user');
	assert(prof!.stats.submitted === 2, `submitted = 2 public (got ${prof!.stats.submitted})`);
	assert(prof!.stats.accepted === 1, 'accepted = 1');

	console.log('[2] recent excludes private-workspace suggestions');
	const titles = prof!.recent.map((r) => r.title);
	assert(titles.includes('Public A') && titles.includes('Public B'), 'public suggestions listed');
	assert(!titles.includes('Private one'), 'private-workspace suggestion hidden');
	assert(prof!.recent.find((r) => r.id === s2)!.votes === 1, 'vote count surfaced');

	console.log('[3] case-insensitive username lookup');
	assert(!!(await getPublicProfile(alice.username.toUpperCase())), 'uppercase username still resolves');

	console.log('[4] unknown + suspended users are not exposed');
	assert((await getPublicProfile('nobody-xyz')) === null, 'unknown username → null');
	await db.update(schema.users).set({ status: 'suspended' }).where(eq(schema.users.id, alice.id));
	assert((await getPublicProfile(alice.username)) === null, 'suspended user hidden');

	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, pubWs.id));
	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, privWs.id));
	for (const u of [alice, bob]) await db.delete(schema.users).where(eq(schema.users.id, u.id));

	console.log('\n✅ smoke-profiles passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-profiles failed:', err);
	await closeDb();
	process.exit(1);
});
