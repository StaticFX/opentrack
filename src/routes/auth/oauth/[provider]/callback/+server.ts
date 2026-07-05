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
import { findOrCreateUserFromOAuth } from '$lib/server/auth/user';
import { safeRedirect } from '$lib/server/util/redirect';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, cookies, url }) => {
	const adapter = await getOAuthAdapter(params.provider);
	if (!adapter) throw error(404, 'Unknown or disabled login provider');

	const { state: storedState, redirectTo } = readOAuthCookies(cookies);
	clearOAuthCookies(cookies);

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	if (!code || !state || !storedState || state !== storedState) {
		throw error(400, 'Invalid or expired OAuth state — please try signing in again.');
	}

	let userId: string;
	try {
		const accessToken = await adapter.validateCode(code);
		const profile = await adapter.fetchProfile(accessToken);
		const user = await findOrCreateUserFromOAuth(adapter.name, profile);
		userId = user.id;
	} catch (err) {
		console.error(`[oauth:${adapter.name}] login failed:`, err);
		throw error(502, 'Login failed while talking to the provider. Please try again.');
	}

	const token = generateSessionToken();
	const { expiresAt } = await createSession(token, userId);
	setSessionCookie(cookies, token, expiresAt);

	throw redirect(302, safeRedirect(redirectTo));
};
