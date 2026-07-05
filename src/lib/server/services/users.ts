import { desc, eq } from 'drizzle-orm';
import type { OAuthProvider, UserStatus } from '$lib/constants';
import { db, schema } from '$lib/server/db';

export interface AdminUserRow {
	id: string;
	username: string;
	displayName: string;
	email: string | null;
	avatarUrl: string | null;
	isAdmin: boolean;
	status: UserStatus;
	createdAt: Date;
	/** True when the user can reach the internal app (member, invitee, or admin). */
	internal: boolean;
	/** OAuth providers the user has linked, e.g. ['github', 'discord']. */
	providers: OAuthProvider[];
}

/**
 * List every user with an internal/external classification and their linked
 * OAuth providers. "Internal" mirrors {@link hasInternalAccess}: admins, anyone
 * with a workspace/project membership, or anyone who redeemed an invite.
 *
 * We fetch the contributing sets separately and merge in JS to stay within the
 * portable query subset (no dialect-specific joins/aggregates).
 */
export async function listUsersAdmin(): Promise<AdminUserRow[]> {
	const [users, wsMembers, projMembers, redemptions, accounts] = await Promise.all([
		db
			.select({
				id: schema.users.id,
				username: schema.users.username,
				displayName: schema.users.displayName,
				email: schema.users.email,
				avatarUrl: schema.users.avatarUrl,
				isAdmin: schema.users.isAdmin,
				status: schema.users.status,
				createdAt: schema.users.createdAt
			})
			.from(schema.users)
			.orderBy(desc(schema.users.createdAt)),
		db.select({ userId: schema.workspaceMembers.userId }).from(schema.workspaceMembers),
		db.select({ userId: schema.projectMembers.userId }).from(schema.projectMembers),
		db.select({ userId: schema.inviteRedemptions.userId }).from(schema.inviteRedemptions),
		db
			.select({ userId: schema.oauthAccounts.userId, provider: schema.oauthAccounts.provider })
			.from(schema.oauthAccounts)
	]);

	const internalIds = new Set<string>();
	for (const r of wsMembers) internalIds.add(r.userId);
	for (const r of projMembers) internalIds.add(r.userId);
	for (const r of redemptions) internalIds.add(r.userId);

	const providersByUser = new Map<string, OAuthProvider[]>();
	for (const a of accounts) {
		const list = providersByUser.get(a.userId) ?? [];
		if (!list.includes(a.provider)) list.push(a.provider);
		providersByUser.set(a.userId, list);
	}

	return users.map((u) => ({
		...u,
		internal: u.isAdmin || internalIds.has(u.id),
		providers: providersByUser.get(u.id) ?? []
	}));
}

/**
 * Suspend or reactivate a user. Suspending immediately revokes access — a
 * suspended user fails session validation — so we also drop their sessions.
 */
export async function setUserStatus(userId: string, status: UserStatus): Promise<void> {
	await db
		.update(schema.users)
		.set({ status, updatedAt: new Date() })
		.where(eq(schema.users.id, userId));
	if (status === 'suspended') {
		await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
	}
}
