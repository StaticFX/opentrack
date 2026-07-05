import { asc, eq } from 'drizzle-orm';
import { OAUTH_PROVIDERS } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import { decryptSecret, encryptSecret } from '$lib/server/crypto';

export interface CustomProvider {
	id: string;
	key: string;
	label: string;
	icon: string | null;
	authorizationEndpoint: string;
	tokenEndpoint: string;
	userinfoEndpoint: string;
	scopes: string;
	clientId: string;
	clientSecret: string; // decrypted
	enabled: boolean;
}

/** Built-in provider keys are reserved and cannot be reused by custom ones. */
export function isReservedKey(key: string): boolean {
	return (OAUTH_PROVIDERS as readonly string[]).includes(key);
}

function decrypt(v: string): string {
	try {
		return decryptSecret(v);
	} catch {
		return '';
	}
}

/** Full custom provider (with decrypted secret) — for building the adapter. */
export async function getCustomProvider(key: string): Promise<CustomProvider | null> {
	const [row] = await db
		.select()
		.from(schema.oauthProviders)
		.where(eq(schema.oauthProviders.key, key))
		.limit(1);
	if (!row || !row.enabled) return null;
	return { ...row, clientSecret: decrypt(row.clientSecret) };
}

/** Enabled custom providers, minimal fields for rendering login buttons. */
export async function listEnabledCustomProviders(): Promise<
	Array<{ key: string; label: string; icon: string | null }>
> {
	const rows = await db
		.select({
			key: schema.oauthProviders.key,
			label: schema.oauthProviders.label,
			icon: schema.oauthProviders.icon,
			enabled: schema.oauthProviders.enabled
		})
		.from(schema.oauthProviders)
		.orderBy(asc(schema.oauthProviders.label));
	return rows.filter((r) => r.enabled).map(({ key, label, icon }) => ({ key, label, icon }));
}

/** All custom providers for the admin form (no secret; `hasSecret` flag instead). */
export async function listCustomProvidersView() {
	const rows = await db
		.select()
		.from(schema.oauthProviders)
		.orderBy(asc(schema.oauthProviders.label));
	return rows.map((r) => ({
		id: r.id,
		key: r.key,
		label: r.label,
		icon: r.icon,
		authorizationEndpoint: r.authorizationEndpoint,
		tokenEndpoint: r.tokenEndpoint,
		userinfoEndpoint: r.userinfoEndpoint,
		scopes: r.scopes,
		clientId: r.clientId,
		hasSecret: !!r.clientSecret,
		enabled: r.enabled
	}));
}

/** Resolve endpoints from an OIDC discovery document (issuer or full URL). */
export async function discoverEndpoints(
	discoveryUrl: string
): Promise<{ authorizationEndpoint: string; tokenEndpoint: string; userinfoEndpoint: string }> {
	const base = discoveryUrl.trim().replace(/\/$/, '');
	const url = base.includes('/.well-known/')
		? base
		: `${base}/.well-known/openid-configuration`;
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

export interface UpsertProviderInput {
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

/** Create or update a custom provider. Throws on validation errors. */
export async function upsertCustomProvider(input: UpsertProviderInput): Promise<void> {
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

export async function deleteCustomProvider(id: string): Promise<void> {
	await db.delete(schema.oauthProviders).where(eq(schema.oauthProviders.id, id));
}
