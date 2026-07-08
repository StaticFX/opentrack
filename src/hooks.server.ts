import { redirect, type Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	deleteSessionCookie,
	validateSessionToken
} from '$lib/server/auth/session';
import { isInitialized } from '$lib/server/auth/setup';
import { ensureStarted } from '$lib/server/startup';

ensureStarted();

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const { user, sessionId } = await validateSessionToken(token);
		event.locals.user = user;
		event.locals.sessionId = sessionId;
		if (!user) deleteSessionCookie(event.cookies);
	} else {
		event.locals.user = null;
		event.locals.sessionId = null;
	}

	// First-run: until the first admin exists, funnel page visits to /setup.
	// `isInitialized()` is memoized, so this is free once the instance is set up.
	const p = event.url.pathname;
	const bypass =
		p === '/setup' || p.startsWith('/auth/') || p.startsWith('/api/') || p.includes('.');
	if (!bypass && !(await isInitialized())) {
		throw redirect(302, '/setup');
	}

	return resolve(event);
};
