import { randomBytes } from 'node:crypto';
import { encodeBase32LowerCaseNoPadding } from '@oslojs/encoding';
import { and, desc, eq } from 'drizzle-orm';
import { hashToken } from '$lib/server/auth/session';
import { db, schema } from '$lib/server/db';

export interface ApiKeyRow {
	id: string;
	name: string;
	prefix: string;
	lastUsedAt: Date | null;
	createdAt: Date;
}

/** Create a key. The raw token is returned ONCE — only its hash is stored. */
export async function createApiKey(
	workspaceId: string,
	name: string,
	createdBy: string
): Promise<{ raw: string; key: ApiKeyRow }> {
	const raw = `otk_${encodeBase32LowerCaseNoPadding(randomBytes(24))}`;
	const prefix = raw.slice(0, 12);
	const [row] = await db
		.insert(schema.apiKeys)
		.values({ workspaceId, name, keyHash: hashToken(raw), prefix, createdBy })
		.returning({
			id: schema.apiKeys.id,
			name: schema.apiKeys.name,
			prefix: schema.apiKeys.prefix,
			lastUsedAt: schema.apiKeys.lastUsedAt,
			createdAt: schema.apiKeys.createdAt
		});
	return { raw, key: row };
}

export async function listApiKeys(workspaceId: string): Promise<ApiKeyRow[]> {
	return db
		.select({
			id: schema.apiKeys.id,
			name: schema.apiKeys.name,
			prefix: schema.apiKeys.prefix,
			lastUsedAt: schema.apiKeys.lastUsedAt,
			createdAt: schema.apiKeys.createdAt
		})
		.from(schema.apiKeys)
		.where(eq(schema.apiKeys.workspaceId, workspaceId))
		.orderBy(desc(schema.apiKeys.createdAt));
}

export async function revokeApiKey(workspaceId: string, id: string): Promise<void> {
	await db
		.delete(schema.apiKeys)
		.where(and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.workspaceId, workspaceId)));
}

/** Resolve a raw key to its workspace, updating last-used. Null if invalid. */
export async function verifyApiKey(raw: string): Promise<{ workspaceId: string } | null> {
	if (!raw) return null;
	const [row] = await db
		.select({ id: schema.apiKeys.id, workspaceId: schema.apiKeys.workspaceId })
		.from(schema.apiKeys)
		.where(eq(schema.apiKeys.keyHash, hashToken(raw)))
		.limit(1);
	if (!row) return null;
	await db.update(schema.apiKeys).set({ lastUsedAt: new Date() }).where(eq(schema.apiKeys.id, row.id));
	return { workspaceId: row.workspaceId };
}
