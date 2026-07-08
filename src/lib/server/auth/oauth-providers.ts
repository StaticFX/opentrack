import { asc, eq } from 'drizzle-orm';
import { OAUTH_BUILTINS, builtinMeta, isBuiltinKey } from '$lib/oauth/catalog';
import { db, schema } from '$lib/server/db';
import { decryptSecret, encryptSecret } from '$lib/server/crypto';

// Single store for ALL OAuth login providers — built-in (github/discord/modrinth)
// and admin-defined custom OIDC. Every provider is a row in `oauth_providers`;
// built-in rows carry `builtin = true` and only their credentials matter (the
// flow logic lives in the code adapters), while custom rows are fully data-driven.

export interface ProviderRow {
	id: string;
	key: string;
	label: string;
	icon: string | null;
	authorizationEndpoint: string;
	tokenEndpoint: string;
	userinfoEndpoint: string;
	scopes: string;
	clientId: string;
	/** Still AES-256-GCM encrypted. */
	clientSecret: string;
	enabled: boolean;
	builtin: boolean;
}

/** A provider row with its client secret decrypted — for building an adapter. */
export interface ResolvedProvider extends Omit<ProviderRow, 'clientSecret'> {
	clientSecret: string;
}

export { isBuiltinKey };

/** Built-in keys are reserved — a custom provider cannot claim one. */
export function isReservedKey(key: string): boolean {
	return isBuiltinKey(key);
}

function decrypt(v: string): string {
	try {
		return decryptSecret(v);
	} catch {
		return '';
	}
}

/** Raw row for a key (secret still encrypted), or null. */
export async function getProviderRow(key: string): Promise<ProviderRow | null> {
	const [row] = await db
		.select()
		.from(schema.oauthProviders)
		.where(eq(schema.oauthProviders.key, key))
		.limit(1);
	return row ?? null;
}

/** Every provider row, ordered built-ins first then custom by label. */
export async function listProviderRows(): Promise<ProviderRow[]> {
	return db.select().from(schema.oauthProviders).orderBy(asc(schema.oauthProviders.label));
}

/** Resolve a provider (decrypted secret) for the login flow — null if disabled. */
export async function getResolvedProvider(key: string): Promise<ResolvedProvider | null> {
	const row = await getProviderRow(key);
	if (!row || !row.enabled) return null;
	return { ...row, clientSecret: decrypt(row.clientSecret) };
}

export async function deleteProvider(id: string): Promise<void> {
	await db.delete(schema.oauthProviders).where(eq(schema.oauthProviders.id, id));
}

export async function deleteProviderByKey(key: string): Promise<void> {
	await db.delete(schema.oauthProviders).where(eq(schema.oauthProviders.key, key));
}

/** Resolve endpoints from an OIDC discovery document (issuer or full URL). */
export async function discoverEndpoints(
	discoveryUrl: string
): Promise<{ authorizationEndpoint: string; tokenEndpoint: string; userinfoEndpoint: string }> {
	const base = discoveryUrl.trim().replace(/\/$/, '');
	const url = base.includes('/.well-known/') ? base : `${base}/.well-known/openid-configuration`;
	const res = await fetch(url, { headers: { Accept: 'application/json' } });
	if (!res.ok) throw new Error(`Discovery failed (${res.status}) for ${url}`);
	const doc = (await res.json()) as Record<string, string>;
	if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.userinfo_endpoint) {
		throw new Error('Discovery document is missing authorization/token/userinfo endpoints');
	}
	return {
		authorizationEndpoint: doc.authorization_endpoint,
		tokenEndpoint: doc.token_endpoint,
		userinfoEndpoint: doc.userinfo_endpoint
	};
}

export interface UpsertCustomInput {
	id?: string;
	key: string;
	label: string;
	icon?: string | null;
	discoveryUrl?: string;
	authorizationEndpoint?: string;
	tokenEndpoint?: string;
	userinfoEndpoint?: string;
	scopes: string;
	clientId: string;
	clientSecret?: string; // omit on update to keep the existing secret
	enabled: boolean;
}

/** Create or update a custom OAuth2 / OIDC provider. Throws on validation errors. */
export async function upsertCustomProvider(input: UpsertCustomInput): Promise<void> {
	const key = input.key.trim().toLowerCase();
	if (!/^[a-z][a-z0-9-]{1,30}$/.test(key)) throw new Error('Key must be a short slug like "google".');
	if (isReservedKey(key)) throw new Error(`"${key}" is a built-in provider key.`);

	let endpoints = {
		authorizationEndpoint: input.authorizationEndpoint?.trim() ?? '',
		tokenEndpoint: input.tokenEndpoint?.trim() ?? '',
		userinfoEndpoint: input.userinfoEndpoint?.trim() ?? ''
	};
	if (input.discoveryUrl?.trim()) {
		endpoints = await discoverEndpoints(input.discoveryUrl);
	}
	if (!endpoints.authorizationEndpoint || !endpoints.tokenEndpoint || !endpoints.userinfoEndpoint) {
		throw new Error('Provide a discovery URL, or all three endpoints (authorization, token, userinfo).');
	}

	const base = {
		key,
		label: input.label.trim() || key,
		icon: input.icon?.trim() || null,
		...endpoints,
		scopes: input.scopes.trim() || 'openid email profile',
		clientId: input.clientId.trim(),
		enabled: input.enabled,
		builtin: false,
		updatedAt: new Date()
	};

	if (input.id) {
		const set: Record<string, unknown> = { ...base };
		if (input.clientSecret?.trim()) set.clientSecret = encryptSecret(input.clientSecret.trim());
		await db.update(schema.oauthProviders).set(set).where(eq(schema.oauthProviders.id, input.id));
	} else {
		if (!input.clientSecret?.trim()) throw new Error('Client secret is required.');
		await db
			.insert(schema.oauthProviders)
			.values({ ...base, clientSecret: encryptSecret(input.clientSecret.trim()) });
	}
}

/**
 * Create or update a built-in provider's credentials + enabled flag. Endpoints,
 * label and icon come from the catalog (the row's flow is owned by code). On a
 * fresh save the client secret is required; a blank secret on update keeps the
 * stored one.
 */
export async function upsertBuiltinProvider(
	key: string,
	input: { clientId: string; clientSecret?: string; enabled: boolean }
): Promise<void> {
	const meta = builtinMeta(key);
	if (!meta) throw new Error(`"${key}" is not a built-in provider.`);
	const existing = await getProviderRow(key);

	const base = {
		key,
		label: meta.name,
		icon: meta.icon,
		authorizationEndpoint: meta.defaults.authorizationEndpoint,
		tokenEndpoint: meta.defaults.tokenEndpoint,
		userinfoEndpoint: meta.defaults.userinfoEndpoint,
		scopes: meta.defaults.scopes,
		clientId: input.clientId.trim(),
		enabled: input.enabled,
		builtin: true,
		updatedAt: new Date()
	};

	if (existing) {
		const set: Record<string, unknown> = { ...base };
		if (input.clientSecret?.trim()) set.clientSecret = encryptSecret(input.clientSecret.trim());
		await db.update(schema.oauthProviders).set(set).where(eq(schema.oauthProviders.id, existing.id));
	} else {
		if (!input.clientSecret?.trim()) throw new Error('Client secret is required.');
		await db
			.insert(schema.oauthProviders)
			.values({ ...base, clientSecret: encryptSecret(input.clientSecret.trim()) });
	}
}

/** Catalog helpers re-exported for the admin view. */
export { OAUTH_BUILTINS, builtinMeta };
