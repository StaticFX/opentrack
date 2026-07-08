import { fail, redirect, type Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import {
	createSession,
	generateSessionToken,
	setSessionCookie
} from '$lib/server/auth/session';
import { enabledProviders } from '$lib/server/auth/oauth';
import { verifyPassword } from '$lib/server/auth/password';
import { isInitialized } from '$lib/server/auth/setup';
import { verifyTotp } from '$lib/server/auth/totp';
import { findUserByUsername } from '$lib/server/auth/user';
import { decryptSecret, encryptSecret } from '$lib/server/crypto';
import { safeRedirect } from '$lib/server/util/redirect';
import type { Actions, PageServerLoad } from './$types';

// Short-lived, encrypted "password verified, awaiting 2FA" marker. Lets step 2
// collect only the code — the password is never re-sent or held in the DOM.
const PENDING_COOKIE = 'ot_2fa_pending';
const PENDING_TTL_MS = 5 * 60_000;

function setPending(cookies: Cookies, userId: string, username: string) {
	const payload = encryptSecret(JSON.stringify({ userId, username, exp: Date.now() + PENDING_TTL_MS }));
	cookies.set(PENDING_COOKIE, payload, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: PENDING_TTL_MS / 1000
	});
}
function readPending(cookies: Cookies): { userId: string; username: string } | null {
	const raw = cookies.get(PENDING_COOKIE);
	if (!raw) return null;
	try {
		const { userId, username, exp } = JSON.parse(decryptSecret(raw));
		if (typeof userId === 'string' && typeof username === 'string' && typeof exp === 'number' && exp > Date.now()) {
			return { userId, username };
		}
	} catch {
		/* tampered / stale */
	}
	return null;
}
function clearPending(cookies: Cookies) {
	cookies.delete(PENDING_COOKIE, { path: '/' });
}

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	if (locals.user) throw redirect(302, safeRedirect(url.searchParams.get('redirect')));
	if (!(await isInitialized())) throw redirect(302, '/setup');

	const pending = readPending(cookies);
	return {
		providers: await enabledProviders(),
		redirectTo: safeRedirect(url.searchParams.get('redirect')),
		pendingUsername: pending?.username ?? null,
		oauthError:
			url.searchParams.get('error') === 'oauth'
				? 'Sign-in with that provider failed or was cancelled. Please try again.'
				: null
	};
};

export const actions: Actions = {
	// Step 1 — verify username + password. If 2FA is on, stash a pending marker
	// and ask for the code (step 2); otherwise sign in immediately.
	password: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');
		if (!username || !password) return fail(400, { error: 'Enter a username and password.', username });

		const user = await findUserByUsername(username);
		const valid =
			user?.isAdmin && user.passwordHash && (await verifyPassword(user.passwordHash, password));
		if (!user || !valid) return fail(400, { error: 'Invalid credentials.', username });

		if (user.totpEnabled && user.totpSecret) {
			setPending(cookies, user.id, user.username);
			return { needCode: true, username: user.username };
		}

		const token = generateSessionToken();
		const { expiresAt } = await createSession(token, user.id);
		setSessionCookie(cookies, token, expiresAt);
		throw redirect(302, safeRedirect(url.searchParams.get('redirect')));
	},

	// Step 2 — verify the one-time code against the pending marker.
	code: async ({ request, cookies, url }) => {
		const pending = readPending(cookies);
		if (!pending) {
			clearPending(cookies);
			return fail(400, { error: 'Your sign-in timed out. Please start again.', reset: true });
		}
		const code = String((await request.formData()).get('code') ?? '').trim();
		if (!code) return fail(400, { error: 'Enter your one-time code.', needCode: true, username: pending.username });

		const [user] = await db.select().from(schema.users).where(eq(schema.users.id, pending.userId)).limit(1);
		if (!user?.isAdmin || !user.totpEnabled || !user.totpSecret) {
			clearPending(cookies);
			return fail(400, { error: 'Your sign-in timed out. Please start again.', reset: true });
		}

		let secret: string;
		try {
			secret = decryptSecret(user.totpSecret);
		} catch {
			return fail(500, { error: 'Two-factor is misconfigured — contact an administrator.', needCode: true, username: pending.username });
		}
		if (!verifyTotp(secret, code)) {
			return fail(400, { error: 'Invalid one-time code.', needCode: true, username: pending.username });
		}

		clearPending(cookies);
		const token = generateSessionToken();
		const { expiresAt } = await createSession(token, user.id);
		setSessionCookie(cookies, token, expiresAt);
		throw redirect(302, safeRedirect(url.searchParams.get('redirect')));
	},

	// Abandon a pending 2FA step and return to the password form.
	cancel: async ({ cookies }) => {
		clearPending(cookies);
		return { reset: true };
	}
};
