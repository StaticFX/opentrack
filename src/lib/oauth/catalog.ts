// Client-safe catalog of the built-in OAuth login providers. This is the single
// source of truth for their identity (label, brand icon) and setup pointers —
// shared by the admin cards, the login buttons, and the server registry. No
// server imports here; it's bundled to the browser.

export interface OAuthProviderMeta {
	/** URL-safe key; matches the login callback path and the settings namespace. */
	key: string;
	/** Display name on cards + login buttons. */
	name: string;
	/** Brand-icon key resolved by `BrandIcon` (falls back to a Lucide glyph). */
	icon: string;
	/** One-line blurb for the admin card. */
	blurb: string;
	/** Where to create the OAuth app. */
	consoleUrl: string;
	/** Provider docs. */
	docsUrl: string;
	/** Optional provider-specific note shown in the config modal. */
	note?: string;
	/** OAuth2 endpoints + scopes for the row (the code adapters own the real flow). */
	defaults: {
		authorizationEndpoint: string;
		tokenEndpoint: string;
		userinfoEndpoint: string;
		scopes: string;
	};
}

/**
 * The built-in providers we ship adapters for. Adding a built-in is: an entry
 * here + an adapter in the server registry (`$lib/server/auth/oauth`).
 */
export const OAUTH_BUILTINS: OAuthProviderMeta[] = [
	{
		key: 'github',
		name: 'GitHub',
		icon: 'github',
		blurb: 'Sign in with a GitHub OAuth (or App) client.',
		consoleUrl: 'https://github.com/settings/developers',
		docsUrl:
			'https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app',
		note: 'A GitHub App client id (Iv…) works too — register the callback URL above under the App’s “Identifying and authorizing users”, and grant Account → Email addresses (read) to capture emails.',
		defaults: {
			authorizationEndpoint: 'https://github.com/login/oauth/authorize',
			tokenEndpoint: 'https://github.com/login/oauth/access_token',
			userinfoEndpoint: 'https://api.github.com/user',
			scopes: 'read:user user:email'
		}
	},
	{
		key: 'discord',
		name: 'Discord',
		icon: 'discord',
		blurb: 'Sign in with a Discord application.',
		consoleUrl: 'https://discord.com/developers/applications',
		docsUrl: 'https://discord.com/developers/docs/topics/oauth2',
		defaults: {
			authorizationEndpoint: 'https://discord.com/oauth2/authorize',
			tokenEndpoint: 'https://discord.com/api/oauth2/token',
			userinfoEndpoint: 'https://discord.com/api/users/@me',
			scopes: 'identify email'
		}
	},
	{
		key: 'modrinth',
		name: 'Modrinth',
		icon: 'modrinth',
		blurb: 'Sign in with a Modrinth application.',
		consoleUrl: 'https://modrinth.com/settings/applications',
		docsUrl: 'https://docs.modrinth.com/api/#section/OAuth',
		defaults: {
			authorizationEndpoint: 'https://modrinth.com/auth/authorize',
			tokenEndpoint: 'https://api.modrinth.com/_internal/oauth/token',
			userinfoEndpoint: 'https://api.modrinth.com/v2/user',
			scopes: 'USER_READ USER_READ_EMAIL'
		}
	}
];

export const BUILTIN_KEYS = OAUTH_BUILTINS.map((b) => b.key);

export function builtinMeta(key: string): OAuthProviderMeta | undefined {
	return OAUTH_BUILTINS.find((b) => b.key === key);
}

export function isBuiltinKey(key: string): boolean {
	return BUILTIN_KEYS.includes(key);
}
