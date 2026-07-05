import { and, eq } from 'drizzle-orm';
import type { ProjectRole, Visibility, WorkspaceRole } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';

// ── Access levels ─────────────────────────────────────────────────────────
// A single 0–4 scale that workspace and project roles both map onto, so
// inherited workspace roles and direct project roles compose via `max`.
export const ACCESS = {
	NONE: 0,
	VIEWER: 1,
	COLLABORATOR: 2,
	MAINTAINER: 3,
	OWNER: 4
} as const;
export type AccessLevel = (typeof ACCESS)[keyof typeof ACCESS];

export const WS_ROLE_TO_ACCESS: Record<WorkspaceRole, AccessLevel> = {
	owner: ACCESS.OWNER,
	admin: ACCESS.MAINTAINER,
	member: ACCESS.COLLABORATOR,
	viewer: ACCESS.VIEWER
};

export const PROJECT_ROLE_TO_ACCESS: Record<ProjectRole, AccessLevel> = {
	maintainer: ACCESS.MAINTAINER,
	collaborator: ACCESS.COLLABORATOR,
	viewer: ACCESS.VIEWER
};

// ── Visibility resolution ───────────────────────────────────────────────
/**
 * Resolve an effective visibility from a top-down chain
 * (workspace → project → board/ticket). `private` at any level caps the rest:
 * a child can never be *more* public than its ancestors.
 */
export function resolveVisibility(chain: Visibility[]): 'public' | 'private' {
	let current: 'public' | 'private' = 'public';
	for (const v of chain) {
		if (v === 'private') current = 'private';
		else if (v === 'public' && current !== 'private') current = 'public';
		// 'inherit' leaves `current` unchanged
	}
	return current;
}

// ── Membership lookups ────────────────────────────────────────────────────
export async function getWorkspaceRole(
	userId: string,
	workspaceId: string
): Promise<WorkspaceRole | null> {
	const [row] = await db
		.select({ role: schema.workspaceMembers.role })
		.from(schema.workspaceMembers)
		.where(
			and(
				eq(schema.workspaceMembers.workspaceId, workspaceId),
				eq(schema.workspaceMembers.userId, userId)
			)
		)
		.limit(1);
	return row?.role ?? null;
}

export async function getProjectRole(
	userId: string,
	projectId: string
): Promise<ProjectRole | null> {
	const [row] = await db
		.select({ role: schema.projectMembers.role })
		.from(schema.projectMembers)
		.where(
			and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, userId))
		)
		.limit(1);
	return row?.role ?? null;
}

export interface ProjectAccess {
	project: typeof schema.projects.$inferSelect;
	workspace: typeof schema.workspaces.$inferSelect;
	level: AccessLevel;
	visibility: 'public' | 'private';
}

/**
 * Resolve a user's effective access to a project, combining global admin,
 * workspace ownership/role, and direct project role. Returns null if the
 * project doesn't exist.
 */
export async function getProjectAccess(
	user: SessionUser | null,
	projectId: string
): Promise<ProjectAccess | null> {
	const [row] = await db
		.select({ project: schema.projects, workspace: schema.workspaces })
		.from(schema.projects)
		.innerJoin(schema.workspaces, eq(schema.projects.workspaceId, schema.workspaces.id))
		.where(eq(schema.projects.id, projectId))
		.limit(1);
	if (!row) return null;

	const visibility = resolveVisibility([row.workspace.visibility, row.project.visibility]);
	let level: AccessLevel = ACCESS.NONE;

	if (user) {
		if (user.isAdmin || row.workspace.ownerId === user.id) {
			level = ACCESS.OWNER;
		} else {
			const wsRole = await getWorkspaceRole(user.id, row.workspace.id);
			const projRole = await getProjectRole(user.id, row.project.id);
			const wsLevel = wsRole ? WS_ROLE_TO_ACCESS[wsRole] : ACCESS.NONE;
			const projLevel = projRole ? PROJECT_ROLE_TO_ACCESS[projRole] : ACCESS.NONE;
			level = Math.max(wsLevel, projLevel) as AccessLevel;
		}
	}

	return { project: row.project, workspace: row.workspace, level, visibility };
}

// ── Capability helpers (operate on an AccessLevel) ─────────────────────────
export const canViewProject = (level: AccessLevel, visibility: 'public' | 'private'): boolean =>
	level >= ACCESS.VIEWER || visibility === 'public';

/** Move cards, edit tickets, add labels to tickets. */
export const canEditProjectContent = (level: AccessLevel): boolean => level >= ACCESS.COLLABORATOR;

/** Edit boards/columns/labels, triage suggestions, manage collaborators. */
export const canManageProject = (level: AccessLevel): boolean => level >= ACCESS.MAINTAINER;

/** Can post a comment: internal collaborators always; the public only when the
 *  project is public, allows public comments, and the user is authenticated. */
export function canComment(
	user: SessionUser | null,
	level: AccessLevel,
	visibility: 'public' | 'private',
	allowPublicComments: boolean
): boolean {
	if (level >= ACCESS.VIEWER) return true;
	return !!user && visibility === 'public' && allowPublicComments;
}

/**
 * Public (non-member) upvotes and comments are locked once an item has been
 * "handled" by a maintainer — a closed ticket or a resolved (non-open)
 * suggestion. Internal viewers and above are never affected.
 */
export function publicInteractionLocked(handled: boolean, level: AccessLevel): boolean {
	return handled && level < ACCESS.VIEWER;
}

// ── Workspace-level capabilities ──────────────────────────────────────────
export function workspaceAccess(
	user: SessionUser | null,
	workspace: typeof schema.workspaces.$inferSelect,
	role: WorkspaceRole | null
): AccessLevel {
	if (!user) return ACCESS.NONE;
	if (user.isAdmin || workspace.ownerId === user.id) return ACCESS.OWNER;
	return role ? WS_ROLE_TO_ACCESS[role] : ACCESS.NONE;
}

export const canCreateProject = (level: AccessLevel): boolean => level >= ACCESS.MAINTAINER;
export const canManageWorkspace = (level: AccessLevel): boolean => level >= ACCESS.MAINTAINER;

// ── Internal access gate ──────────────────────────────────────────────────
/**
 * Whether a user may enter the internal (app) area at all: admins, anyone with
 * a workspace/project membership, or anyone who has redeemed an invite code.
 */
export async function hasInternalAccess(user: SessionUser | null): Promise<boolean> {
	if (!user) return false;
	if (user.isAdmin) return true;

	const [ws] = await db
		.select({ userId: schema.workspaceMembers.userId })
		.from(schema.workspaceMembers)
		.where(eq(schema.workspaceMembers.userId, user.id))
		.limit(1);
	if (ws) return true;

	const [proj] = await db
		.select({ userId: schema.projectMembers.userId })
		.from(schema.projectMembers)
		.where(eq(schema.projectMembers.userId, user.id))
		.limit(1);
	if (proj) return true;

	const [redeemed] = await db
		.select({ userId: schema.inviteRedemptions.userId })
		.from(schema.inviteRedemptions)
		.where(eq(schema.inviteRedemptions.userId, user.id))
		.limit(1);
	return !!redeemed;
}
