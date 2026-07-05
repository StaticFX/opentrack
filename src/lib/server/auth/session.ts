import { randomBytes } from 'node:crypto';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';
import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';

export const SESSION_COOKIE = 'ot_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_RENEW_MS = 1000 * 60 * 60 * 24 * 15; // renew when <15 days left

/** The subset of user fields carried on `locals.user`. */
export interface SessionUser {
	id: string;
	username: string;
	displayName: string;
	email: string | null;
	avatarUrl: string | null;
	isAdmin: boolean;
}

export interface SessionValidationResult {
	user: SessionUser | null;
	sessionId: string | null;
}

/** Generate a new opaque session token (kept only in the cookie). */
export function generateSessionToken(): string {
	return encodeBase32LowerCaseNoPadding(randomBytes(20));
}

/** The session row id is the hash of the token, so the raw token never hits the DB. */
export function hashToken(token: string): string {
	return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

export async function createSession(token: string, userId: string): Promise<{ id: string; expiresAt: Date }> {
	const id = hashToken(token);
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
	await db.insert(schema.sessions).values({ id, userId, expiresAt });
	return { id, expiresAt };
}

export async function validateSessionToken(token: string): Promise<SessionValidationResult> {
	const id = hashToken(token);
	const [row] = await db
		.select({
			sessionId: schema.sessions.id,
			expiresAt: schema.sessions.expiresAt,
			user: {
				id: schema.users.id,
				username: schema.users.username,
				displayName: schema.users.displayName,
				email: schema.users.email,
				avatarUrl: schema.users.avatarUrl,
				isAdmin: schema.users.isAdmin,
				status: schema.users.status
			}
		})
		.from(schema.sessions)
		.innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
		.where(eq(schema.sessions.id, id))
		.limit(1);

	if (!row) return { user: null, sessionId: null };

	if (Date.now() >= row.expiresAt.getTime()) {
		await db.delete(schema.sessions).where(eq(schema.sessions.id, id));
		return { user: null, sessionId: null };
	}

	if (row.user.status === 'suspended') {
		return { user: null, sessionId: null };
	}

	// Sliding expiration: extend the session when it's close to expiring.
	if (row.expiresAt.getTime() - Date.now() < SESSION_RENEW_MS) {
		await db
			.update(schema.sessions)
			.set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
			.where(eq(schema.sessions.id, id));
	}

	const { status: _status, ...user } = row.user;
	return { user, sessionId: row.sessionId };
}

export async function invalidateSession(sessionId: string): Promise<void> {
	await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}

export async function invalidateUserSessions(userId: string): Promise<void> {
	await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date): void {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		expires: expiresAt
	});
}

export function deleteSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
