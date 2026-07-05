import { createHmac } from 'node:crypto';
import { env } from '$lib/server/env';

/** Sign a state payload for the GitHub install redirect (prevents forgery). */
export function signState(payload: string): string {
	const sig = createHmac('sha256', env.secret).update(payload).digest('base64url');
	return `${payload}.${sig}`;
}

export function verifyState(state: string | null): string | null {
	if (!state) return null;
	const idx = state.lastIndexOf('.');
	if (idx < 0) return null;
	const payload = state.slice(0, idx);
	const sig = state.slice(idx + 1);
	const expected = createHmac('sha256', env.secret).update(payload).digest('base64url');
	return sig === expected ? payload : null;
}
