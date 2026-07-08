import { fail, redirect } from '@sveltejs/kit';
import { createSession, generateSessionToken, setSessionCookie } from '$lib/server/auth/session';
import { adminExists, claimAdmin, setupArmed } from '$lib/server/auth/setup';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Setup is a one-time flow — once an admin exists, send people to sign in.
	if (await adminExists()) throw redirect(302, '/auth/login');
	return { armed: await setupArmed() };
};

export const actions: Actions = {
	claim: async ({ request, cookies }) => {
		if (await adminExists()) throw redirect(302, '/auth/login');

		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const code = String(form.get('code') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm') ?? '');

		if (username.length < 2)
			return fail(400, { error: 'Choose a username (at least 2 characters).', field: 'account', username });
		if (!/^[a-zA-Z0-9_.-]+$/.test(username))
			return fail(400, { error: 'Username may only contain letters, numbers, and . _ -', field: 'account', username });
		if (!code)
			return fail(400, { error: 'Enter the setup code from your server logs.', field: 'account', username });
		if (password.length < 8)
			return fail(400, { error: 'Use a password of at least 8 characters.', field: 'password', username });
		if (password !== confirm)
			return fail(400, { error: 'Passwords do not match.', field: 'password', username });

		const user = await claimAdmin({ username, code, password });
		if (!user)
			return fail(400, {
				error: 'That setup code is invalid or has already been used. Check your server logs.',
				field: 'account',
				username
			});

		const token = generateSessionToken();
		const { expiresAt } = await createSession(token, user.id);
		setSessionCookie(cookies, token, expiresAt);
		throw redirect(302, '/');
	}
};
