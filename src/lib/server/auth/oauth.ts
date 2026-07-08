import { Discord, GitHub } from 'arctic';
import type { Cookies } from '@sveltejs/kit';
import { OAUTH_BUILTINS, isBuiltinKey } from '$lib/oauth/catalog';
import { env } from '$lib/server/env';
import {
	deleteProvider,
	deleteProviderByKey,
	getResolvedProvider,
	listProviderRows,
	upsertBuiltinProvider,
	upsertCustomProvider,
	type ResolvedProvider
} from './oauth-providers';

export { upsertCustomProvider };
export { deleteProvider as deleteCustomProvider };

/** Normalized profile returned by every provider adapter. */
export interface OAuthProfile {
	providerUserId: string;
	username: string;
	displayName: string;
	email: string | null;
	avatarUrl: string | null;
}

/** The contract every OAuth provider (built-in or custom) implements. */
export interface OAuthAdapter {
	name: string;
	createAuthorizationURL(state: string): URL;
	/** Exchange the code for an access token. */
	validateCode(code: string): Promise<string>;
	fetchProfile(accessToken: string): Promise<OAuthProfile>;
}

/** A provider available to render as a login button. */
export interface ProviderButton {
	key: string;
	label: string;
	icon: string | null;
	builtin: boolean;
}

function redirectURI(provider: string): string {
	return `${env.origin}/auth/oauth/${provider}/callback`;
}

async function fetchJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
	const res = await fetch(url, init);
	if (!res.ok) {
		throw new Error(`OAuth request to ${url} failed: ${res.status} ${await res.text()}`);
	}
	return (await res.json()) as Record<string, unknown>;
}

// ── GitHub ───────────────────────────────────────────────────────────────
function githubAdapter(clientId: string, clientSecret: string): OAuthAdapter {
	const client = new GitHub(clientId, clientSecret, redirectURI('github'));
	// GitHub *App* client IDs start with "Iv". Apps authorize users off their
	// configured permissions and reject the OAuth-App `scope` param — sending it
	// makes the authorize page 404. OAuth Apps (id "Ov…"/legacy hex) need scopes.
	const isGithubApp = /^Iv/i.test(clientId);
	return {
		name: 'github',
		createAuthorizationURL: (state) => {
			if (isGithubApp) {
				const u = new URL('https://github.com/login/oauth/authorize');
				u.searchParams.set('client_id', clientId);
				u.searchParams.set('redirect_uri', redirectURI('github'));
				u.searchParams.set('state', state);
				return u;
			}
			return client.createAuthorizationURL(state, ['read:user', 'user:email']);
		},
		validateCode: async (code) => (await client.validateAuthorizationCode(code)).accessToken(),
		async fetchProfile(accessToken) {
			const headers = {
				Authorization: `Bearer ${accessToken}`,
				Accept: 'application/vnd.github+json',
				'User-Agent': 'OpenTrack'
			};
			const user = await fetchJson('https://api.github.com/user', { headers });
			let email = (user.email as string | null) ?? null;
			if (!email) {
				// Email is optional: if the token can't read /user/emails (missing
				// scope, rate-limited, or restricted), GitHub returns a non-array
				// error object — don't let that crash the whole sign-in.
				try {
					const res = await fetch('https://api.github.com/user/emails', { headers });
					const emails: unknown = res.ok ? await res.json() : null;
					if (Array.isArray(emails)) {
						email =
							(emails as Array<{ email: string; primary: boolean; verified: boolean }>).find(
								(e) => e?.primary && e?.verified
							)?.email ?? null;
					}
				} catch {
					/* leave email null */
				}
			}
			return {
				providerUserId: String(user.id),
				username: user.login as string,
				displayName: (user.name as string) || (user.login as string),
				email,
				avatarUrl: (user.avatar_url as string) ?? null
			};
		}
	};
}

// ── Discord ──────────────────────────────────────────────────────────────
function discordAdapter(clientId: string, clientSecret: string): OAuthAdapter {
	const client = new Discord(clientId, clientSecret, redirectURI('discord'));
	return {
		name: 'discord',
		createAuthorizationURL: (state) => client.createAuthorizationURL(state, null, ['identify', 'email']),
		validateCode: async (code) => (await client.validateAuthorizationCode(code, null)).accessToken(),
		async fetchProfile(accessToken) {
			const user = await fetchJson('https://discord.com/api/users/@me', {
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			const id = user.id as string;
			const avatarHash = user.avatar as string | null;
			return {
				providerUserId: id,
				username: user.username as string,
				displayName: (user.global_name as string) || (user.username as string),
				email: (user.email as string | null) ?? null,
				avatarUrl: avatarHash
					? `https://cdn.discordapp.com/avatars/${id}/${avatarHash}.png`
					: null
			};
		}
	};
}

// ── Modrinth (custom OAuth2: non-standard token endpoint, secret in header) ─
const MODRINTH_AUTHORIZE = 'https://modrinth.com/auth/authorize';
const MODRINTH_TOKEN = 'https://api.modrinth.com/_internal/oauth/token';
const MODRINTH_USER = 'https://api.modrinth.com/v2/user';
// Scope identifiers live in labrinth's pats.rs; USER_READ covers profile access.
const MODRINTH_SCOPES = ['USER_READ', 'USER_READ_EMAIL'];

function modrinthAdapter(clientId: string, clientSecret: string): OAuthAdapter {
	return {
		name: 'modrinth',
		createAuthorizationURL(state) {
			const url = new URL(MODRINTH_AUTHORIZE);
			url.searchParams.set('client_id', clientId);
			url.searchParams.set('redirect_uri', redirectURI('modrinth'));
			url.searchParams.set('response_type', 'code');
			url.searchParams.set('state', state);
			// Modrinth wants scopes joined by '+', which URLSearchParams would
			// otherwise percent-encode; set it raw.
			url.searchParams.set('scope', MODRINTH_SCOPES.join('+'));
			return url;
		},
		async validateCode(code) {
			const body = new URLSearchParams({
				code,
				client_id: clientId,
				redirect_uri: redirectURI('modrinth'),
				grant_type: 'authorization_code'
			});
			const data = await fetchJson(MODRINTH_TOKEN, {
				method: 'POST',
				headers: {
					// Modrinth expects the client secret directly in Authorization.
					Authorization: clientSecret,
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body
			});
			return data.access_token as string;
		},
		async fetchProfile(accessToken) {
			// Modrinth API takes the token in Authorization without a "Bearer" prefix.
			const user = await fetchJson(MODRINTH_USER, { headers: { Authorization: accessToken } });
			return {
				providerUserId: user.id as string,
				username: user.username as string,
				displayName: (user.name as string) || (user.username as string),
				email: (user.email as string | null) ?? null,
				avatarUrl: (user.avatar_url as string) ?? null
			};
		}
	};
}

// ── Generic OAuth2 / OIDC (admin-defined custom providers) ─────────────────
function genericAdapter(p: ResolvedProvider): OAuthAdapter {
	const redirect = redirectURI(p.key);
	return {
		name: p.key,
		createAuthorizationURL(state) {
			const u = new URL(p.authorizationEndpoint);
			u.searchParams.set('response_type', 'code');
			u.searchParams.set('client_id', p.clientId);
			u.searchParams.set('redirect_uri', redirect);
			u.searchParams.set('scope', p.scopes);
			u.searchParams.set('state', state);
			return u;
		},
		async validateCode(code) {
			const data = await fetchJson(p.tokenEndpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
				body: new URLSearchParams({
					grant_type: 'authorization_code',
					code,
					client_id: p.clientId,
					client_secret: p.clientSecret,
					redirect_uri: redirect
				})
			});
			return data.access_token as string;
		},
		async fetchProfile(accessToken) {
			const u = await fetchJson(p.userinfoEndpoint, {
				headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
			});
			// Resolve standard OIDC claims with common fallbacks.
			const s = (v: unknown) => (v == null || v === '' ? null : String(v));
			const id = s(u.sub) ?? s(u.id) ?? s(u.user_id);
			if (!id) throw new Error('userinfo response had no user id (sub/id)');
			const email = s(u.email);
			const username =
				s(u.preferred_username) ?? s(u.login) ?? s(u.username) ?? (email ? email.split('@')[0] : id);
			const displayName = s(u.name) ?? s(u.display_name) ?? username;
			const avatarUrl = s(u.picture) ?? s(u.avatar_url) ?? s(u.avatar);
			return { providerUserId: id, username, displayName, email, avatarUrl };
		}
	};
}

/** Registry of built-in adapter factories, keyed by provider key. */
const BUILTIN_ADAPTERS: Record<string, (clientId: string, clientSecret: string) => OAuthAdapter> = {
	github: githubAdapter,
	discord: discordAdapter,
	modrinth: modrinthAdapter
};

/** Build the adapter for a provider, or null if it isn't configured/enabled. */
export async function getOAuthAdapter(provider: string): Promise<OAuthAdapter | null> {
	const resolved = await getResolvedProvider(provider);
	if (!resolved || !resolved.clientId || !resolved.clientSecret) return null;
	if (isBuiltinKey(provider)) {
		const factory = BUILTIN_ADAPTERS[provider];
		return factory ? factory(resolved.clientId, resolved.clientSecret) : null;
	}
	return genericAdapter(resolved);
}

/** Providers configured & enabled — for rendering login buttons (built-in + custom). */
export async function enabledProviders(): Promise<ProviderButton[]> {
	const rows = await listProviderRows();
	return rows
		.filter((r) => r.enabled && r.clientId && r.clientSecret)
		.map((r) => {
			const meta = r.builtin ? OAUTH_BUILTINS.find((b) => b.key === r.key) : undefined;
			return {
				key: r.key,
				label: meta?.name ?? r.label,
				icon: meta?.icon ?? r.icon,
				builtin: r.builtin
			};
		});
}

// ── Admin service (unified view + writes for the Privacy card UI) ──────────

/** One provider row for the admin cards + config modal. Secrets never leak. */
export interface ProviderView {
	kind: 'builtin' | 'custom';
	/** Login key (built-in key or custom slug). */
	key: string;
	/** Custom-provider row id (absent for built-ins). */
	id?: string;
	name: string;
	icon: string;
	blurb: string;
	clientId: string;
	hasSecret: boolean;
	enabled: boolean;
	/** True when the provider is fully configured and enabled (shows on login). */
	active: boolean;
	/** Built-in setup pointers. */
	meta?: { consoleUrl: string; docsUrl: string; note?: string };
	/** Custom endpoint config (absent for built-ins). */
	authorizationEndpoint?: string;
	tokenEndpoint?: string;
	userinfoEndpoint?: string;
	scopes?: string;
}

/** Every provider (built-in + custom) for the admin Privacy page. */
export async function listProvidersView(): Promise<ProviderView[]> {
	const rows = await listProviderRows();
	const byKey = new Map(rows.map((r) => [r.key, r]));

	// Built-ins always show (even unconfigured) so the cards are discoverable.
	const builtins: ProviderView[] = OAUTH_BUILTINS.map((b) => {
		const row = byKey.get(b.key);
		const clientId = row?.clientId ?? '';
		const hasSecret = !!row?.clientSecret;
		const enabled = row?.enabled ?? false;
		return {
			kind: 'builtin' as const,
			key: b.key,
			name: b.name,
			icon: b.icon,
			blurb: b.blurb,
			clientId,
			hasSecret,
			enabled,
			active: !!(clientId && hasSecret && enabled),
			meta: { consoleUrl: b.consoleUrl, docsUrl: b.docsUrl, note: b.note }
		};
	});

	const customs: ProviderView[] = rows
		.filter((r) => !r.builtin)
		.map((r) => ({
			kind: 'custom' as const,
			key: r.key,
			id: r.id,
			name: r.label,
			icon: r.icon || r.key,
			blurb: 'Custom OAuth2 / OIDC provider.',
			clientId: r.clientId,
			hasSecret: !!r.clientSecret,
			enabled: r.enabled,
			active: r.enabled && !!r.clientId && !!r.clientSecret,
			authorizationEndpoint: r.authorizationEndpoint,
			tokenEndpoint: r.tokenEndpoint,
			userinfoEndpoint: r.userinfoEndpoint,
			scopes: r.scopes
		}));

	return [...builtins, ...customs];
}

/** Save a built-in provider's credentials + enabled flag. Empty id removes it. */
export async function saveBuiltinProvider(
	key: string,
	input: { clientId: string; clientSecret?: string; enabled: boolean }
): Promise<void> {
	if (!isBuiltinKey(key)) throw new Error(`"${key}" is not a built-in provider.`);
	if (!input.clientId) {
		await deleteProviderByKey(key);
		return;
	}
	await upsertBuiltinProvider(key, input);
}

/** Callback URL template for the admin UI. */
export function callbackUrl(providerKey: string): string {
	return redirectURI(providerKey);
}

// ── OAuth flow cookies (state + post-login redirect target) ───────────────
const STATE_COOKIE = 'ot_oauth_state';
const REDIRECT_COOKIE = 'ot_oauth_redirect';
const LINK_COOKIE = 'ot_oauth_link';

export function setOAuthCookies(
	cookies: Cookies,
	state: string,
	redirectTo: string,
	link = false
): void {
	const opts = {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 10
	};
	cookies.set(STATE_COOKIE, state, opts);
	cookies.set(REDIRECT_COOKIE, redirectTo, opts);
	if (link) cookies.set(LINK_COOKIE, '1', opts);
	else cookies.delete(LINK_COOKIE, { path: '/' });
}

export function readOAuthCookies(cookies: Cookies): {
	state: string | null;
	redirectTo: string;
	link: boolean;
} {
	return {
		state: cookies.get(STATE_COOKIE) ?? null,
		redirectTo: cookies.get(REDIRECT_COOKIE) ?? '/',
		link: cookies.get(LINK_COOKIE) === '1'
	};
}

export function clearOAuthCookies(cookies: Cookies): void {
	cookies.delete(STATE_COOKIE, { path: '/' });
	cookies.delete(REDIRECT_COOKIE, { path: '/' });
	cookies.delete(LINK_COOKIE, { path: '/' });
}
