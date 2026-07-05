import { fail, redirect } from '@sveltejs/kit';
import {
	createSession,
	generateSessionToken,
	setSessionCookie
} from '$lib/server/auth/session';
import { enabledProviders } from '$lib/server/auth/oauth';
import { verifyPassword } from '$lib/server/auth/password';
import { findUserByEmail } from '$lib/server/auth/user';
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
	// Admin email + password login.
	admin: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		if (!email || !password) return fail(400, { error: 'Enter an email and password.', email });

		const user = await findUserByEmail(email);
		const valid =
			user?.isAdmin && user.passwordHash && (await verifyPassword(user.passwordHash, password));
		if (!user || !valid) return fail(400, { error: 'Invalid credentials.', email });

		const token = generateSessionToken();
		const { expiresAt } = await createSession(token, user.id);
		setSessionCookie(cookies, token, expiresAt);
		throw redirect(302, safeRedirect(url.searchParams.get('redirect')));
	}
};
