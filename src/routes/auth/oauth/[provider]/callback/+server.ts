import { error, redirect } from '@sveltejs/kit';
import {
	clearOAuthCookies,
	getOAuthAdapter,
	readOAuthCookies
} from '$lib/server/auth/oauth';
import {
	createSession,
	generateSessionToken,
	setSessionCookie
} from '$lib/server/auth/session';
import { findOrCreateUserFromOAuth, linkOAuthAccount } from '$lib/server/auth/user';
import { safeRedirect } from '$lib/server/util/redirect';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, cookies, url, locals }) => {
	const adapter = await getOAuthAdapter(params.provider);
	if (!adapter) throw error(404, 'Unknown or disabled login provider');

	const { state: storedState, redirectTo, link } = readOAuthCookies(cookies);
	clearOAuthCookies(cookies);

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	if (!code || !state || !storedState || state !== storedState) {
		throw error(400, 'Invalid or expired OAuth state — please try signing in again.');
	}

	let profile;
	try {
		const accessToken = await adapter.validateCode(code);
		profile = await adapter.fetchProfile(accessToken);
	} catch (err) {
		console.error(`[oauth:${adapter.name}] failed:`, err);
		// Transient/expired-code and provider hiccups shouldn't dump a raw 502 —
		// send the user back to sign-in with a friendly, retryable message.
		const dest = link && locals.user ? safeRedirect(redirectTo) : '/auth/login';
		const sep = dest.includes('?') ? '&' : '?';
		throw redirect(302, `${dest}${sep}error=oauth`);
	}

	// Link mode: attach this identity to the already-logged-in user, no new session.
	if (link && locals.user) {
		const res = await linkOAuthAccount(locals.user.id, adapter.name, profile);
		const dest = safeRedirect(redirectTo);
		const sep = dest.includes('?') ? '&' : '?';
		throw redirect(302, `${dest}${sep}linked=${res.ok ? adapter.name : 'taken'}`);
	}

	const user = await findOrCreateUserFromOAuth(adapter.name, profile);
	const token = generateSessionToken();
	const { expiresAt } = await createSession(token, user.id);
	setSessionCookie(cookies, token, expiresAt);

	throw redirect(302, safeRedirect(redirectTo));
};
