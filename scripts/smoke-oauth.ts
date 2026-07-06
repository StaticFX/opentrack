// Verify GitHub OAuth login is correct for both GitHub Apps and OAuth Apps:
// - App client IDs ("Iv…") authorize WITHOUT a scope param (Apps reject it → 404)
// - OAuth App IDs keep scopes
// - /user/emails returning a non-array never crashes fetchProfile
process.env.GITHUB_CLIENT_ID = 'Iv23testAppId';
process.env.GITHUB_CLIENT_SECRET = 'test-secret';
process.env.ORIGIN = 'https://track.example.com';

import '$lib/server/load-env';
import { invalidateConfig } from '$lib/server/config';
import { getOAuthAdapter } from '$lib/server/auth/oauth';
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

async function main() {
	console.log('[1] GitHub App id → authorize URL omits scope');
	const appAdapter = await getOAuthAdapter('github');
	assert(!!appAdapter, 'app adapter builds');
	const appUrl = appAdapter!.createAuthorizationURL('STATE123');
	assert(appUrl.origin + appUrl.pathname === 'https://github.com/login/oauth/authorize', 'correct authorize endpoint');
	assert(appUrl.searchParams.get('scope') === null, 'NO scope param for a GitHub App (avoids the 404)');
	assert(appUrl.searchParams.get('client_id') === 'Iv23testAppId', 'client_id carried');
	assert(appUrl.searchParams.get('state') === 'STATE123', 'state carried');
	assert(appUrl.searchParams.get('redirect_uri') === 'https://track.example.com/auth/oauth/github/callback', 'redirect_uri carried');

	console.log('[2] OAuth App id → keeps scopes');
	process.env.GITHUB_CLIENT_ID = 'Ov23testOAuthApp';
	invalidateConfig();
	const oauthAdapter = await getOAuthAdapter('github');
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
	console.log('\n✅ smoke-oauth passed');
	await closeDb();
}

main().catch(async (err) => {
	globalThis.fetch = realFetch;
	console.error('\n❌ smoke-oauth failed:', err);
	await closeDb();
	process.exit(1);
});
