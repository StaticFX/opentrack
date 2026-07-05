import type { Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	deleteSessionCookie,
	validateSessionToken
} from '$lib/server/auth/session';
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

	// Route-group authorization (admin/internal gating) is layered on in M2.
	return resolve(event);
};
