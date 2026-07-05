import type { SessionUser } from '$lib/server/auth/session';

declare global {
	namespace App {
		interface Locals {
			/** The authenticated user, or null for anonymous visitors. */
			user: SessionUser | null;
			/** The raw session token id, if a session cookie was present. */
			sessionId: string | null;
		}
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
