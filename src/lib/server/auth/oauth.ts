import { Discord, GitHub } from 'arctic';
import type { Cookies } from '@sveltejs/kit';
import type { OAuthProvider } from '$lib/constants';
import { OAUTH_PROVIDERS } from '$lib/constants';
import { getConfig } from '$lib/server/config';
import { env } from '$lib/server/env';

/** Normalized profile returned by every provider adapter. */
export interface OAuthProfile {
	providerUserId: string;
	username: string;
	displayName: string;
	email: string | null;
	avatarUrl: string | null;
}

export interface OAuthAdapter {
	name: OAuthProvider;
	createAuthorizationURL(state: string): URL;
	/** Exchange the code for an access token. */
	validateCode(code: string): Promise<string>;
	fetchProfile(accessToken: string): Promise<OAuthProfile>;
}

function redirectURI(provider: OAuthProvider): string {
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
	return {
		name: 'github',
		createAuthorizationURL: (state) => client.createAuthorizationURL(state, ['read:user', 'user:email']),
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
				const emails = (await (
					await fetch('https://api.github.com/user/emails', { headers })
				).json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
				email = emails.find((e) => e.primary && e.verified)?.email ?? null;
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

/** Build the adapter for a provider, or null if it isn't configured. */
export async function getOAuthAdapter(provider: string): Promise<OAuthAdapter | null> {
	if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) return null;
	const cfg = await getConfig();
	const cred = cfg.oauth[provider as OAuthProvider];
	if (!cred) return null;
	switch (provider) {
		case 'github':
			return githubAdapter(cred.clientId, cred.clientSecret);
		case 'discord':
			return discordAdapter(cred.clientId, cred.clientSecret);
		case 'modrinth':
			return modrinthAdapter(cred.clientId, cred.clientSecret);
		default:
			return null;
	}
}

/** Provider names that are configured (used to render login buttons). */
export async function enabledProviders(): Promise<OAuthProvider[]> {
	const cfg = await getConfig();
	return OAUTH_PROVIDERS.filter((p) => cfg.oauth[p] !== null);
}

// ── OAuth flow cookies (state + post-login redirect target) ───────────────
const STATE_COOKIE = 'ot_oauth_state';
const REDIRECT_COOKIE = 'ot_oauth_redirect';

export function setOAuthCookies(cookies: Cookies, state: string, redirectTo: string): void {
	const opts = {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 10
	};
	cookies.set(STATE_COOKIE, state, opts);
	cookies.set(REDIRECT_COOKIE, redirectTo, opts);
}

export function readOAuthCookies(cookies: Cookies): { state: string | null; redirectTo: string } {
	return {
		state: cookies.get(STATE_COOKIE) ?? null,
		redirectTo: cookies.get(REDIRECT_COOKIE) ?? '/'
	};
}

export function clearOAuthCookies(cookies: Cookies): void {
	cookies.delete(STATE_COOKIE, { path: '/' });
	cookies.delete(REDIRECT_COOKIE, { path: '/' });
}
