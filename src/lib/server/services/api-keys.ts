import { randomBytes } from 'node:crypto';
import { encodeBase32LowerCaseNoPadding } from '@oslojs/encoding';
import { and, desc, eq } from 'drizzle-orm';
import { effectiveScopes, normalizeScopes, type ApiScope } from '$lib/apiScopes';
import { hashToken } from '$lib/server/auth/session';
import { db, schema } from '$lib/server/db';

export interface ApiKeyRow {
	id: string;
	name: string;
	prefix: string;
	scopes: ApiScope[];
	lastUsedAt: Date | null;
	createdAt: Date;
}

/** Create a key. The raw token is returned ONCE — only its hash is stored. */
export async function createApiKey(
	workspaceId: string,
	name: string,
	createdBy: string,
	scopes: ApiScope[] = ['read', 'write']
): Promise<{ raw: string; key: ApiKeyRow }> {
	const clean = normalizeScopes(scopes);
	const finalScopes = clean.length ? clean : (['read'] as ApiScope[]);
	const raw = `otk_${encodeBase32LowerCaseNoPadding(randomBytes(24))}`;
	const prefix = raw.slice(0, 12);
	const [row] = await db
		.insert(schema.apiKeys)
		.values({ workspaceId, name, keyHash: hashToken(raw), prefix, scopes: finalScopes, createdBy })
		.returning({
			id: schema.apiKeys.id,
			name: schema.apiKeys.name,
			prefix: schema.apiKeys.prefix,
			scopes: schema.apiKeys.scopes,
			lastUsedAt: schema.apiKeys.lastUsedAt,
			createdAt: schema.apiKeys.createdAt
		});
	return { raw, key: { ...row, scopes: effectiveScopes(row.scopes) } };
}

export async function listApiKeys(workspaceId: string): Promise<ApiKeyRow[]> {
	const rows = await db
		.select({
			id: schema.apiKeys.id,
			name: schema.apiKeys.name,
			prefix: schema.apiKeys.prefix,
			scopes: schema.apiKeys.scopes,
			lastUsedAt: schema.apiKeys.lastUsedAt,
			createdAt: schema.apiKeys.createdAt
		})
		.from(schema.apiKeys)
		.where(eq(schema.apiKeys.workspaceId, workspaceId))
		.orderBy(desc(schema.apiKeys.createdAt));
	return rows.map((r) => ({ ...r, scopes: effectiveScopes(r.scopes) }));
}

/** Every key across the instance, with its workspace — for the admin page. */
export async function listAllApiKeys(): Promise<
	Array<ApiKeyRow & { workspaceId: string; workspaceName: string }>
> {
	const rows = await db
		.select({
			id: schema.apiKeys.id,
			name: schema.apiKeys.name,
			prefix: schema.apiKeys.prefix,
			scopes: schema.apiKeys.scopes,
			lastUsedAt: schema.apiKeys.lastUsedAt,
			createdAt: schema.apiKeys.createdAt,
			workspaceId: schema.apiKeys.workspaceId,
			workspaceName: schema.workspaces.name
		})
		.from(schema.apiKeys)
		.innerJoin(schema.workspaces, eq(schema.apiKeys.workspaceId, schema.workspaces.id))
		.orderBy(desc(schema.apiKeys.createdAt));
	return rows.map((r) => ({ ...r, scopes: effectiveScopes(r.scopes) }));
}

export async function revokeApiKey(workspaceId: string, id: string): Promise<void> {
	await db
		.delete(schema.apiKeys)
		.where(and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.workspaceId, workspaceId)));
}

/** Revoke any key by id (admin — not constrained to one workspace). */
export async function revokeApiKeyById(id: string): Promise<void> {
	await db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, id));
}

/** Resolve a raw key to its workspace + scopes, updating last-used. Null if invalid. */
export async function verifyApiKey(
	raw: string
): Promise<{ workspaceId: string; scopes: ApiScope[] } | null> {
	const full = await verifyApiKeyFull(raw);
	return full ? { workspaceId: full.workspaceId, scopes: full.scopes } : null;
}

/**
 * Like `verifyApiKey`, but also returns the key's creator (the actor writes are
 * attributed to). `actorId` is null if the creator's account was removed.
 */
export async function verifyApiKeyFull(
	raw: string
): Promise<{ workspaceId: string; actorId: string | null; scopes: ApiScope[] } | null> {
	if (!raw) return null;
	const [row] = await db
		.select({
			id: schema.apiKeys.id,
			workspaceId: schema.apiKeys.workspaceId,
			createdBy: schema.apiKeys.createdBy,
			scopes: schema.apiKeys.scopes
		})
		.from(schema.apiKeys)
		.where(eq(schema.apiKeys.keyHash, hashToken(raw)))
		.limit(1);
	if (!row) return null;
	await db.update(schema.apiKeys).set({ lastUsedAt: new Date() }).where(eq(schema.apiKeys.id, row.id));
	return { workspaceId: row.workspaceId, actorId: row.createdBy ?? null, scopes: effectiveScopes(row.scopes) };
}
