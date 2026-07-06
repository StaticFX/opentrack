import '$lib/server/load-env';
import { eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { reactionsFor, summarize, toggleReaction } from '$lib/server/services/reactions';

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
	const T = 'ticket';
	const id = 'tk-' + Date.now();
	const id2 = 'tk2-' + Date.now();

	console.log('[1] toggle on → count + per-user reacted flag');
	let s = await toggleReaction(T, id, alice.id, '🎉');
	assert(s.length === 1 && s[0].emoji === '🎉' && s[0].count === 1 && s[0].reacted, 'alice added 🎉');
	const bobView = await summarize(T, id, bob.id);
	assert(bobView[0].count === 1 && bobView[0].reacted === false, "bob sees count 1 but reacted=false");

	console.log('[2] second user same emoji → count 2');
	s = await toggleReaction(T, id, bob.id, '🎉');
	assert(s[0].count === 2 && s[0].reacted, 'count 2 after bob adds');

	console.log('[3] idempotent per user+emoji (toggle removes, no dup)');
	s = await toggleReaction(T, id, alice.id, '🎉'); // alice removes
	assert(s[0].count === 1, 'alice toggle off → back to 1');
	const rows = await db.select().from(schema.reactions).where(eq(schema.reactions.subjectId, id));
	assert(rows.length === 1, 'exactly one reaction row remains (no duplicates)');

	console.log('[4] multiple emojis grouped + ordered by palette');
	await toggleReaction(T, id, alice.id, '🚀');
	await toggleReaction(T, id, alice.id, '👍');
	const grouped = await summarize(T, id, alice.id);
	const emojis = grouped.map((r) => r.emoji);
	assert(emojis.includes('👍') && emojis.includes('🎉') && emojis.includes('🚀'), 'all three present');
	assert(emojis.indexOf('👍') < emojis.indexOf('🎉') && emojis.indexOf('🎉') < emojis.indexOf('🚀'), 'ordered by REACTION_EMOJI palette');

	console.log('[5] batched reactionsFor across subjects');
	await toggleReaction(T, id2, bob.id, '❤️');
	const batch = await reactionsFor(T, [id, id2], bob.id);
	assert(batch.get(id)!.some((r) => r.emoji === '🎉'), 'batch has subject 1');
	assert(batch.get(id2)![0].emoji === '❤️' && batch.get(id2)![0].reacted, 'batch has subject 2 with bob reacted');
	assert((await reactionsFor(T, [], bob.id)).size === 0, 'empty id list → empty map');

	// cleanup
	await db.delete(schema.reactions).where(eq(schema.reactions.subjectId, id));
	await db.delete(schema.reactions).where(eq(schema.reactions.subjectId, id2));
	for (const u of [alice, bob]) await db.delete(schema.users).where(eq(schema.users.id, u.id));

	console.log('\n✅ smoke-reactions passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-reactions failed:', err);
	await closeDb();
	process.exit(1);
});
