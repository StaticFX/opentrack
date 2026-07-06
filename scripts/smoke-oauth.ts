// Verify the GitHub OAuth profile fetch is robust when /user/emails returns a
// non-array error object (the bug that produced ".find is not a function").
process.env.GITHUB_CLIENT_ID = 'test-client';
process.env.GITHUB_CLIENT_SECRET = 'test-secret';
process.env.ORIGIN = 'https://track.example.com';

import '$lib/server/load-env';
import { closeDb } from '$lib/server/db';
import { getOAuthAdapter } from '$lib/server/auth/oauth';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}

const realFetch = globalThis.fetch;
function mock(emailsBody: unknown, emailsOk = true) {
	globalThis.fetch = (async (url: string) => {
		const u = String(url);
		if (u.endsWith('/user')) {
			return { ok: true, status: 200, json: async () => ({ id: 42, login: 'octocat', name: 'Octo Cat', email: null, avatar_url: 'https://x/y.png' }) } as Response;
		}
		if (u.endsWith('/user/emails')) {
			return { ok: emailsOk, status: emailsOk ? 200 : 403, text: async () => 'err', json: async () => emailsBody } as Response;
		}
		throw new Error(`unexpected fetch ${u}`);
	}) as unknown as typeof fetch;
}

async function main() {
	const adapter = await getOAuthAdapter('github');
	assert(!!adapter, 'github adapter builds from env creds');

	console.log('[1] /user/emails returns a non-array error object → no crash, email null');
	mock({ message: 'Requires authentication', documentation_url: '...' }, false);
	const p1 = await adapter!.fetchProfile('tok');
	assert(p1.username === 'octocat' && p1.email === null, 'profile resolves with null email (no .find crash)');

	console.log('[2] /user/emails returns 200 but a non-array body → still safe');
	mock({ not: 'an array' }, true);
	const p2 = await adapter!.fetchProfile('tok');
	assert(p2.email === null, 'non-array 200 body yields null email');

	console.log('[3] normal array response → primary verified email chosen');
	mock([
		{ email: 'secondary@x.io', primary: false, verified: true },
		{ email: 'primary@x.io', primary: true, verified: true }
	]);
	const p3 = await adapter!.fetchProfile('tok');
	assert(p3.email === 'primary@x.io', 'picks the primary+verified email');
	assert(p3.displayName === 'Octo Cat' && p3.avatarUrl === 'https://x/y.png', 'other profile fields mapped');

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
