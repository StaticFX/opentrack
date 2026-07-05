import { createHmac, randomUUID } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { env } from '$lib/server/env';
import type { SessionUser } from '$lib/server/auth/session';
import type { VoterKey } from '$lib/server/services/votes';

const ANON_COOKIE = 'ot_anon';

/** Stable-per-browser anonymous id, combined with IP and HMAC'd for dedup. */
function anonKey(cookies: Cookies, ip: string): string {
	let id = cookies.get(ANON_COOKIE);
	if (!id) {
		id = randomUUID().replace(/-/g, '');
		cookies.set(ANON_COOKIE, id, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 365
		});
	}
	return createHmac('sha256', env.secret).update(`${id}:${ip}`).digest('hex');
}

/** Resolve the voter identity: the logged-in user, or an anonymous key. */
export function resolveVoter(
	user: SessionUser | null,
	cookies: Cookies,
	getClientAddress: () => string
): VoterKey {
	if (user) return { userId: user.id };
	let ip = '0.0.0.0';
	try {
		ip = getClientAddress();
	} catch {
		/* address unavailable */
	}
	return { anonKey: anonKey(cookies, ip) };
}
