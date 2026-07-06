import '$lib/server/load-env';
import { eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { createApiKey, listApiKeys, revokeApiKey, verifyApiKey } from '$lib/server/services/api-keys';
import { createWorkspace } from '$lib/server/services/workspaces';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}

async function main() {
	const [u] = await db.insert(schema.users).values({ username: `key-${Date.now()}`, displayName: 'Keymaster' }).returning();
	const user: SessionUser = { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };
	const ws = await createWorkspace(user, { name: 'Key WS' });
	const other = await createWorkspace(user, { name: 'Other WS' });

	console.log('[1] create returns a raw token; only the hash is stored');
	const { raw, key } = await createApiKey(ws.id, 'Docs site', user.id);
	assert(raw.startsWith('otk_') && raw.length > 20, 'raw key has otk_ prefix');
	assert(key.prefix === raw.slice(0, 12), 'display prefix matches key start');
	const [stored] = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.id, key.id));
	assert(stored.keyHash !== raw && !stored.keyHash.includes(raw.slice(4)), 'raw token is not stored verbatim');

	console.log('[2] verify resolves workspace + stamps last-used');
	const before = (await db.select({ l: schema.apiKeys.lastUsedAt }).from(schema.apiKeys).where(eq(schema.apiKeys.id, key.id)))[0].l;
	assert(before === null, 'lastUsedAt starts null');
	const v = await verifyApiKey(raw);
	assert(v?.workspaceId === ws.id, 'verify returns the owning workspace');
	const after = (await db.select({ l: schema.apiKeys.lastUsedAt }).from(schema.apiKeys).where(eq(schema.apiKeys.id, key.id)))[0].l;
	assert(after !== null, 'lastUsedAt updated after verify');

	console.log('[3] bad + empty tokens rejected');
	assert((await verifyApiKey('otk_bogus')) === null, 'wrong token → null');
	assert((await verifyApiKey('')) === null, 'empty token → null');

	console.log('[4] list scopes to the workspace, never leaks the hash');
	const list = await listApiKeys(ws.id);
	assert(list.length === 1 && list[0].id === key.id, 'lists the workspace key');
	assert(!('keyHash' in list[0]), 'hash not included in the list projection');
	assert((await listApiKeys(other.id)).length === 0, 'other workspace has none');

	console.log('[5] revoke invalidates the key');
	await revokeApiKey(ws.id, key.id);
	assert((await verifyApiKey(raw)) === null, 'revoked key no longer verifies');
	assert((await listApiKeys(ws.id)).length === 0, 'key removed from the list');

	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, other.id));
	await db.delete(schema.users).where(eq(schema.users.id, user.id));

	console.log('\n✅ smoke-apikeys passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-apikeys failed:', err);
	await closeDb();
	process.exit(1);
});
