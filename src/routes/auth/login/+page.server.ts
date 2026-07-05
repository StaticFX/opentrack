import { fail, redirect } from '@sveltejs/kit';
import {
	createSession,
	generateSessionToken,
	setSessionCookie
} from '$lib/server/auth/session';
import { enabledProviders } from '$lib/server/auth/oauth';
import { verifyPassword } from '$lib/server/auth/password';
import { verifyTotp } from '$lib/server/auth/totp';
import { findUserByUsername } from '$lib/server/auth/user';
import { decryptSecret } from '$lib/server/crypto';
import { safeRedirect } from '$lib/server/util/redirect';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) throw redirect(302, safeRedirect(url.searchParams.get('redirect')));
	return {
		providers: await enabledProviders(),
		redirectTo: safeRedirect(url.searchParams.get('redirect'))
	};
};

export const actions: Actions = {
	// Admin login: username + password (+ one-time code when 2FA is enabled).
	admin: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const code = String(form.get('code') ?? '');
		if (!username || !password) return fail(400, { error: 'Enter a username and password.', username });

		const user = await findUserByUsername(username);
		const valid =
			user?.isAdmin && user.passwordHash && (await verifyPassword(user.passwordHash, password));
		if (!user || !valid) return fail(400, { error: 'Invalid credentials.', username });

		// Second factor: required only for accounts with 2FA turned on.
		if (user.totpEnabled && user.totpSecret) {
			let secret: string;
			try {
				secret = decryptSecret(user.totpSecret);
			} catch {
				return fail(500, { error: 'Two-factor is misconfigured — contact support.', username });
			}
			if (!code) return fail(400, { error: 'Enter your one-time code.', username, needCode: true });
			if (!verifyTotp(secret, code)) {
				return fail(400, { error: 'Invalid one-time code.', username, needCode: true });
			}
		}

		const token = generateSessionToken();
		const { expiresAt } = await createSession(token, user.id);
		setSessionCookie(cookies, token, expiresAt);
		throw redirect(302, safeRedirect(url.searchParams.get('redirect')));
	}
};
