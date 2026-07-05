import '$lib/server/load-env';
import { eq } from 'drizzle-orm';
import { closeDb, db, dbDriver, schema } from '$lib/server/db';
import {
	createSession,
	generateSessionToken,
	invalidateSession,
	validateSessionToken
} from '$lib/server/auth/session';
import { drain, enqueue } from '$lib/server/jobs';
import { registerAllHandlers } from '$lib/server/jobs';

async function main() {
	console.log(`[smoke] driver=${dbDriver}`);

	// 1. Insert + read a user (exercises app-generated UUID + Date columns).
	const [user] = await db
		.insert(schema.users)
		.values({ username: 'smoke_user', displayName: 'Smoke User', email: 'smoke@example.com' })
		.returning();
	console.log(`[smoke] inserted user id=${user.id} createdAt=${user.createdAt.toISOString()}`);
	if (!(user.createdAt instanceof Date)) throw new Error('createdAt not a Date');

	// 2. Session create + validate round-trip.
	const token = generateSessionToken();
	const { id: sessionId } = await createSession(token, user.id);
	const res = await validateSessionToken(token);
	if (res.user?.id !== user.id) throw new Error('session validation failed');
	console.log(`[smoke] session validated for ${res.user.username}, isAdmin=${res.user.isAdmin}`);
	await invalidateSession(sessionId);
	const afterLogout = await validateSessionToken(token);
	if (afterLogout.user) throw new Error('session not invalidated');
	console.log('[smoke] session invalidation ok');

	// 3. Portable job queue: enqueue + drain.
	registerAllHandlers();
	await enqueue('noop', { hello: 'world' });
	const processed = await drain('smoke-worker');
	console.log(`[smoke] drained ${processed} job(s)`);
	if (processed < 1) throw new Error('job not processed');

	// 4. Cleanup.
	await db.delete(schema.users).where(eq(schema.users.id, user.id));
	await db.delete(schema.jobs);
	console.log('[smoke] ✓ all checks passed');
	await closeDb();
}

main().catch((err) => {
	console.error('[smoke] FAILED:', err);
	process.exit(1);
});
