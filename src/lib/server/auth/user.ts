import { and, eq } from 'drizzle-orm';
import type { OAuthProvider } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import { hashPassword } from './password';
import type { OAuthProfile } from './oauth';

export type User = typeof schema.users.$inferSelect;

function slugifyUsername(input: string): string {
	const base = input
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 32);
	return base.length >= 2 ? base : `user-${base}`;
}

/** Find a free username derived from `desired`, appending -2, -3, … on collision. */
export async function ensureUniqueUsername(desired: string): Promise<string> {
	const base = slugifyUsername(desired);
	for (let i = 0; ; i++) {
		const candidate = i === 0 ? base : `${base}-${i + 1}`;
		const [existing] = await db
			.select({ id: schema.users.id })
			.from(schema.users)
			.where(eq(schema.users.username, candidate))
			.limit(1);
		if (!existing) return candidate;
	}
}

/**
 * Resolve the user for an OAuth login:
 *  1. existing linked account → that user
 *  2. verified email matches an existing user → link a new account to them
 *  3. otherwise create a fresh user + account
 */
export async function findOrCreateUserFromOAuth(
	provider: OAuthProvider,
	profile: OAuthProfile
): Promise<User> {
	const [linked] = await db
		.select()
		.from(schema.oauthAccounts)
		.innerJoin(schema.users, eq(schema.oauthAccounts.userId, schema.users.id))
		.where(
			and(
				eq(schema.oauthAccounts.provider, provider),
				eq(schema.oauthAccounts.providerUserId, profile.providerUserId)
			)
		)
		.limit(1);

	if (linked) {
		// Keep the cached provider profile fresh.
		await db
			.update(schema.oauthAccounts)
			.set({ providerUsername: profile.username, avatarUrl: profile.avatarUrl })
			.where(
				and(
					eq(schema.oauthAccounts.provider, provider),
					eq(schema.oauthAccounts.providerUserId, profile.providerUserId)
				)
			);
		return linked.users;
	}

	// Link to an existing account with the same email.
	let user: User | undefined;
	if (profile.email) {
		[user] = await db
			.select()
			.from(schema.users)
			.where(eq(schema.users.email, profile.email))
			.limit(1);
	}

	if (!user) {
		const username = await ensureUniqueUsername(profile.username);
		[user] = await db
			.insert(schema.users)
			.values({
				username,
				displayName: profile.displayName,
				email: profile.email,
				avatarUrl: profile.avatarUrl
			})
			.returning();
	}

	await db.insert(schema.oauthAccounts).values({
		userId: user.id,
		provider,
		providerUserId: profile.providerUserId,
		providerUsername: profile.username,
		avatarUrl: profile.avatarUrl
	});

	return user;
}

/** OAuth providers currently linked to a user (for the account page). */
export async function listLinkedAccounts(
	userId: string
): Promise<Array<{ provider: OAuthProvider; providerUsername: string | null; avatarUrl: string | null }>> {
	return db
		.select({
			provider: schema.oauthAccounts.provider,
			providerUsername: schema.oauthAccounts.providerUsername,
			avatarUrl: schema.oauthAccounts.avatarUrl
		})
		.from(schema.oauthAccounts)
		.where(eq(schema.oauthAccounts.userId, userId));
}

/**
 * Attach an OAuth identity to an existing (logged-in) user. One identity per
 * provider per user — re-linking replaces it. Fails if that identity already
 * belongs to a different account.
 */
export async function linkOAuthAccount(
	userId: string,
	provider: OAuthProvider,
	profile: OAuthProfile
): Promise<{ ok: true } | { ok: false; reason: 'taken' }> {
	const [existing] = await db
		.select({ id: schema.oauthAccounts.id, userId: schema.oauthAccounts.userId })
		.from(schema.oauthAccounts)
		.where(
			and(
				eq(schema.oauthAccounts.provider, provider),
				eq(schema.oauthAccounts.providerUserId, profile.providerUserId)
			)
		)
		.limit(1);

	if (existing) {
		if (existing.userId !== userId) return { ok: false, reason: 'taken' };
		await db
			.update(schema.oauthAccounts)
			.set({ providerUsername: profile.username, avatarUrl: profile.avatarUrl })
			.where(eq(schema.oauthAccounts.id, existing.id));
		return { ok: true };
	}

	// Replace any prior identity this user had for the same provider.
	await db
		.delete(schema.oauthAccounts)
		.where(and(eq(schema.oauthAccounts.userId, userId), eq(schema.oauthAccounts.provider, provider)));
	await db.insert(schema.oauthAccounts).values({
		userId,
		provider,
		providerUserId: profile.providerUserId,
		providerUsername: profile.username,
		avatarUrl: profile.avatarUrl
	});
	return { ok: true };
}

/** Remove a linked OAuth identity from a user. */
export async function unlinkOAuthAccount(userId: string, provider: OAuthProvider): Promise<void> {
	await db
		.delete(schema.oauthAccounts)
		.where(and(eq(schema.oauthAccounts.userId, userId), eq(schema.oauthAccounts.provider, provider)));
}

/** Create (or return) an admin user with an email + password. */
export async function createAdminUser(email: string, password: string): Promise<User> {
	const [existing] = await db
		.select()
		.from(schema.users)
		.where(eq(schema.users.email, email))
		.limit(1);
	if (existing) return existing;

	const username = await ensureUniqueUsername(email.split('@')[0] || 'admin');
	const passwordHash = await hashPassword(password);
	const [user] = await db
		.insert(schema.users)
		.values({
			email,
			username,
			displayName: username,
			isAdmin: true,
			passwordHash
		})
		.returning();
	return user;
}

/** Look up an admin by email for password login. */
export async function findUserByEmail(email: string): Promise<User | null> {
	const [user] = await db
		.select()
		.from(schema.users)
		.where(eq(schema.users.email, email))
		.limit(1);
	return user ?? null;
}
