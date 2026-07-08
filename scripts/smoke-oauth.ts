// Verify DB-backed OAuth login providers end to end:
// - built-in credentials are stored in the DB (no env), resolved by getOAuthAdapter
// - GitHub App client ids ("Iv…") authorize WITHOUT a scope param (Apps 404 on it)
// - OAuth App ids keep scopes; a blank secret on re-save keeps the stored one
// - /user/emails returning a non-array never crashes fetchProfile
// - enable/disable and clearing are reflected in the adapter + login buttons + admin view
process.env.ORIGIN = 'https://track.example.com';

import '$lib/server/load-env';
import {
	enabledProviders,
	getOAuthAdapter,
	listProvidersView,
	saveBuiltinProvider
} from '$lib/server/auth/oauth';
import { closeDb } from '$lib/server/db';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}

const realFetch = globalThis.fetch;
function mockEmails(body: unknown, ok = true) {
	globalThis.fetch = (async (url: string) => {
		const u = String(url);
		if (u.endsWith('/user')) {
			return { ok: true, status: 200, json: async () => ({ id: 42, login: 'octocat', name: 'Octo Cat', email: null, avatar_url: 'https://x/y.png' }) } as Response;
		}
		if (u.endsWith('/user/emails')) {
			return { ok, status: ok ? 200 : 403, text: async () => 'err', json: async () => body } as Response;
		}
		throw new Error(`unexpected fetch ${u}`);
	}) as unknown as typeof fetch;
}

const gh = () => listProvidersView().then((v) => v.find((p) => p.key === 'github')!);

async function main() {
	// Clean slate (in case a previous run left state).
	await saveBuiltinProvider('github', { clientId: '', enabled: false });

	console.log('[1] GitHub App id stored in the DB → authorize URL omits scope');
	await saveBuiltinProvider('github', { clientId: 'Iv23testAppId', clientSecret: 'test-secret', enabled: true });
	const appAdapter = await getOAuthAdapter('github');
	assert(!!appAdapter, 'adapter builds from DB-stored credentials (no env)');
	const appUrl = appAdapter!.createAuthorizationURL('STATE123');
	assert(appUrl.origin + appUrl.pathname === 'https://github.com/login/oauth/authorize', 'correct authorize endpoint');
	assert(appUrl.searchParams.get('scope') === null, 'NO scope param for a GitHub App (avoids the 404)');
	assert(appUrl.searchParams.get('client_id') === 'Iv23testAppId', 'client_id carried');
	assert(appUrl.searchParams.get('state') === 'STATE123', 'state carried');
	assert(appUrl.searchParams.get('redirect_uri') === 'https://track.example.com/auth/oauth/github/callback', 'redirect_uri carried');

	console.log('[2] OAuth App id → keeps scopes; blank secret on re-save keeps the stored one');
	await saveBuiltinProvider('github', { clientId: 'Ov23testOAuthApp', enabled: true }); // no clientSecret → keep
	const oauthAdapter = await getOAuthAdapter('github');
	assert(!!oauthAdapter, 'adapter still builds (secret retained)');
	const scope = oauthAdapter!.createAuthorizationURL('S').searchParams.get('scope') ?? '';
	assert(scope.includes('read:user') && scope.includes('user:email'), 'OAuth App still requests read:user + user:email');

	console.log('[3] fetchProfile robust to non-array /user/emails (no .find crash)');
	mockEmails({ message: 'Requires authentication' }, false);
	const p1 = await appAdapter!.fetchProfile('tok');
	assert(p1.username === 'octocat' && p1.email === null, 'error body → null email, no crash');

	console.log('[4] fetchProfile picks primary verified email when available');
	mockEmails([
		{ email: 'secondary@x.io', primary: false, verified: true },
		{ email: 'primary@x.io', primary: true, verified: true }
	]);
	const p2 = await appAdapter!.fetchProfile('tok');
	assert(p2.email === 'primary@x.io', 'primary+verified email chosen');
	globalThis.fetch = realFetch;

	console.log('[5] enabledProviders + admin view reflect DB state, never leak the secret');
	assert((await enabledProviders()).some((p) => p.key === 'github' && p.builtin), 'github is an enabled login button');
	const g = await gh();
	assert(g.kind === 'builtin' && g.active && g.hasSecret && g.clientId === 'Ov23testOAuthApp', 'view: active, hasSecret, correct client id');
	assert(!('clientSecret' in (g as Record<string, unknown>)), 'admin view never includes the decrypted secret');

	console.log('[6] disabling keeps creds but removes it from login + adapter');
	await saveBuiltinProvider('github', { clientId: 'Ov23testOAuthApp', enabled: false });
	assert((await getOAuthAdapter('github')) === null, 'disabled → no adapter (cannot sign in)');
	assert(!(await enabledProviders()).some((p) => p.key === 'github'), 'disabled → not a login button');
	const g2 = await gh();
	assert(!g2.active && g2.hasSecret && !g2.enabled, 'still configured (hasSecret) but inactive');

	console.log('[7] clearing the client id removes the provider entirely');
	await saveBuiltinProvider('github', { clientId: '', enabled: false });
	const g3 = await gh();
	assert(!g3.hasSecret && !g3.clientId && !g3.active, 'cleared → no stored credentials');

	console.log('\n✅ smoke-oauth passed');
	await closeDb();
}

main().catch(async (err) => {
	globalThis.fetch = realFetch;
	console.error('\n❌ smoke-oauth failed:', err);
	await closeDb();
	process.exit(1);
});
