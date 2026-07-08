import { randomBytes } from 'node:crypto';
import { encodeBase32UpperCaseNoPadding } from '@oslojs/encoding';
import { and, desc, eq } from 'drizzle-orm';
import type { InviteScope, ProjectRole, WorkspaceRole } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import type { SessionUser } from './session';
import { hashToken } from './session';

/** Normalize user-entered codes (strip separators, uppercase) before hashing. */
function normalizeCode(code: string): string {
	return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/** Present a code grouped for readability: ABCD-EFGH-IJKL-MNOP. */
function formatCode(raw: string): string {
	return raw.match(/.{1,4}/g)?.join('-') ?? raw;
}

export interface GenerateInviteParams {
	createdBy: string;
	scope: InviteScope;
	roleGrant: WorkspaceRole | ProjectRole | 'member';
	workspaceId?: string;
	projectId?: string;
	maxUses?: number;
	expiresAt?: Date | null;
	note?: string;
}

/** Create an invite code; returns the plaintext code (shown only once). */
export async function generateInviteCode(
	params: GenerateInviteParams
): Promise<{ code: string; id: string }> {
	const raw = encodeBase32UpperCaseNoPadding(randomBytes(10));
	const codeHash = hashToken(normalizeCode(raw));

	const [row] = await db
		.insert(schema.inviteCodes)
		.values({
			codeHash,
			createdBy: params.createdBy,
			scope: params.scope,
			roleGrant: params.roleGrant,
			workspaceId: params.workspaceId ?? null,
			projectId: params.projectId ?? null,
			maxUses: params.maxUses ?? 1,
			expiresAt: params.expiresAt ?? null,
			note: params.note ?? null
		})
		.returning({ id: schema.inviteCodes.id });

	return { code: formatCode(raw), id: row.id };
}

export interface InviteSummary {
	id: string;
	roleGrant: string;
	uses: number;
	maxUses: number;
	note: string | null;
	createdAt: Date;
	expiresAt: Date | null;
}

function summarizeInvites(rows: (typeof schema.inviteCodes.$inferSelect)[]): InviteSummary[] {
	return rows.map((r) => ({
		id: r.id,
		roleGrant: r.roleGrant,
		uses: r.uses,
		maxUses: r.maxUses,
		note: r.note,
		createdAt: r.createdAt,
		expiresAt: r.expiresAt
	}));
}

/** Active invite codes for a workspace (newest first). Codes are never re-shown. */
export async function listWorkspaceInvites(workspaceId: string): Promise<InviteSummary[]> {
	const rows = await db
		.select()
		.from(schema.inviteCodes)
		.where(and(eq(schema.inviteCodes.scope, 'workspace'), eq(schema.inviteCodes.workspaceId, workspaceId)))
		.orderBy(desc(schema.inviteCodes.createdAt));
	return summarizeInvites(rows);
}

/** Active invite codes for a project (newest first). */
export async function listProjectInvites(projectId: string): Promise<InviteSummary[]> {
	const rows = await db
		.select()
		.from(schema.inviteCodes)
		.where(and(eq(schema.inviteCodes.scope, 'project'), eq(schema.inviteCodes.projectId, projectId)))
		.orderBy(desc(schema.inviteCodes.createdAt));
	return summarizeInvites(rows);
}

/** Delete (revoke) a workspace invite, scoped so it must belong to the workspace. */
export async function deleteWorkspaceInvite(id: string, workspaceId: string): Promise<void> {
	await db
		.delete(schema.inviteCodes)
		.where(and(eq(schema.inviteCodes.id, id), eq(schema.inviteCodes.workspaceId, workspaceId)));
}

/** Delete (revoke) a project invite, scoped so it must belong to the project. */
export async function deleteProjectInvite(id: string, projectId: string): Promise<void> {
	await db
		.delete(schema.inviteCodes)
		.where(and(eq(schema.inviteCodes.id, id), eq(schema.inviteCodes.projectId, projectId)));
}

export type RedeemResult =
	| { ok: true; scope: InviteScope; workspaceId: string | null; projectId: string | null; alreadyRedeemed: boolean }
	| { ok: false; reason: 'not_found' | 'expired' | 'exhausted' };

/** Redeem an invite for a user, applying the coded grant. Idempotent per user. */
export async function redeemInviteCode(user: SessionUser, input: string): Promise<RedeemResult> {
	const codeHash = hashToken(normalizeCode(input));

	return db.transaction(async (tx) => {
		const [invite] = await tx
			.select()
			.from(schema.inviteCodes)
			.where(eq(schema.inviteCodes.codeHash, codeHash))
			.limit(1);
		if (!invite) return { ok: false, reason: 'not_found' } as const;

		if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
			return { ok: false, reason: 'expired' } as const;
		}

		// Already redeemed by this user → succeed idempotently, no extra grant.
		const [prior] = await tx
			.select({ id: schema.inviteRedemptions.id })
			.from(schema.inviteRedemptions)
			.where(
				and(
					eq(schema.inviteRedemptions.inviteId, invite.id),
					eq(schema.inviteRedemptions.userId, user.id)
				)
			)
			.limit(1);
		if (prior) {
			return {
				ok: true,
				scope: invite.scope,
				workspaceId: invite.workspaceId,
				projectId: invite.projectId,
				alreadyRedeemed: true
			} as const;
		}

		if (invite.uses >= invite.maxUses) return { ok: false, reason: 'exhausted' } as const;

		// Apply the grant.
		if (invite.scope === 'workspace' && invite.workspaceId) {
			await tx
				.insert(schema.workspaceMembers)
				.values({
					workspaceId: invite.workspaceId,
					userId: user.id,
					role: (invite.roleGrant as WorkspaceRole) ?? 'member'
				})
				.onConflictDoNothing();
		} else if (invite.scope === 'project' && invite.projectId) {
			await tx
				.insert(schema.projectMembers)
				.values({
					projectId: invite.projectId,
					userId: user.id,
					role: (invite.roleGrant as ProjectRole) ?? 'collaborator'
				})
				.onConflictDoNothing();
		}
		// 'global' scope: redemption row alone grants internal access.

		await tx.insert(schema.inviteRedemptions).values({ inviteId: invite.id, userId: user.id });
		await tx
			.update(schema.inviteCodes)
			.set({ uses: invite.uses + 1 })
			.where(eq(schema.inviteCodes.id, invite.id));

		return {
			ok: true,
			scope: invite.scope,
			workspaceId: invite.workspaceId,
			projectId: invite.projectId,
			alreadyRedeemed: false
		} as const;
	});
}
