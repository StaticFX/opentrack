import { and, asc, count, eq, inArray, isNull, or } from 'drizzle-orm';
import type { Visibility, WorkspaceRole } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { workspaceAccess, type AccessLevel } from '$lib/server/permissions';
import { slugify } from '$lib/server/util/slug';

export type Workspace = typeof schema.workspaces.$inferSelect;

export interface WorkspaceListing {
	workspace: Workspace;
	role: WorkspaceRole | null;
}

/** Workspaces the user can see in their sidebar (owned, member, or all if admin). */
export async function listForUser(user: SessionUser): Promise<WorkspaceListing[]> {
	const rows = await db
		.select({ workspace: schema.workspaces, role: schema.workspaceMembers.role })
		.from(schema.workspaces)
		.leftJoin(
			schema.workspaceMembers,
			and(
				eq(schema.workspaceMembers.workspaceId, schema.workspaces.id),
				eq(schema.workspaceMembers.userId, user.id)
			)
		)
		.where(
			user.isAdmin
				? undefined
				: or(eq(schema.workspaces.ownerId, user.id), eq(schema.workspaceMembers.userId, user.id))
		)
		.orderBy(asc(schema.workspaces.name));

	return rows.map((r) => ({ workspace: r.workspace, role: r.role }));
}

/** All public workspaces (for the public landing/explore page). */
export async function listPublic(): Promise<Workspace[]> {
	return db
		.select()
		.from(schema.workspaces)
		.where(eq(schema.workspaces.visibility, 'public'))
		.orderBy(asc(schema.workspaces.name));
}

export async function ensureUniqueSlug(desired: string, excludeId?: string): Promise<string> {
	const base = slugify(desired);
	for (let i = 0; ; i++) {
		const candidate = i === 0 ? base : `${base}-${i + 1}`;
		const [existing] = await db
			.select({ id: schema.workspaces.id })
			.from(schema.workspaces)
			.where(eq(schema.workspaces.slug, candidate))
			.limit(1);
		if (!existing || existing.id === excludeId) return candidate;
	}
}

export interface CreateWorkspaceInput {
	name: string;
	slug?: string;
	description?: string;
	visibility?: Visibility;
}

/** Create a workspace and add the creator as its owner. */
export async function createWorkspace(
	user: SessionUser,
	input: CreateWorkspaceInput
): Promise<Workspace> {
	const slug = await ensureUniqueSlug(input.slug || input.name);
	return db.transaction(async (tx) => {
		const [ws] = await tx
			.insert(schema.workspaces)
			.values({
				slug,
				name: input.name,
				description: input.description ?? null,
				visibility: input.visibility === 'private' ? 'private' : 'public',
				ownerId: user.id
			})
			.returning();
		await tx
			.insert(schema.workspaceMembers)
			.values({ workspaceId: ws.id, userId: user.id, role: 'owner' });
		return ws;
	});
}

export interface WorkspaceContext {
	workspace: Workspace;
	role: WorkspaceRole | null;
	access: AccessLevel;
}

/** Load a workspace by slug with the user's effective access. */
export async function getForUser(
	user: SessionUser | null,
	slug: string
): Promise<WorkspaceContext | null> {
	const [row] = await db
		.select({ workspace: schema.workspaces, role: schema.workspaceMembers.role })
		.from(schema.workspaces)
		.leftJoin(
			schema.workspaceMembers,
			and(
				eq(schema.workspaceMembers.workspaceId, schema.workspaces.id),
				eq(schema.workspaceMembers.userId, user?.id ?? '')
			)
		)
		.where(eq(schema.workspaces.slug, slug))
		.limit(1);
	if (!row) return null;
	return {
		workspace: row.workspace,
		role: row.role,
		access: workspaceAccess(user, row.workspace, row.role)
	};
}

export interface UpdateWorkspaceInput {
	name?: string;
	description?: string | null;
	visibility?: Visibility;
	icon?: string | null;
	color?: string | null;
	avatarUrl?: string | null;
	publicHeadline?: string | null;
	publicTagline?: string | null;
}

export async function updateWorkspace(
	workspaceId: string,
	patch: UpdateWorkspaceInput
): Promise<void> {
	await db
		.update(schema.workspaces)
		.set({
			...(patch.name !== undefined ? { name: patch.name } : {}),
			...(patch.description !== undefined ? { description: patch.description } : {}),
			...(patch.visibility !== undefined
				? { visibility: patch.visibility === 'private' ? 'private' : 'public' }
				: {}),
			...(patch.icon !== undefined ? { icon: patch.icon } : {}),
			...(patch.color !== undefined ? { color: patch.color } : {}),
			...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
			...(patch.publicHeadline !== undefined ? { publicHeadline: patch.publicHeadline } : {}),
			...(patch.publicTagline !== undefined ? { publicTagline: patch.publicTagline } : {}),
			updatedAt: new Date()
		})
		.where(eq(schema.workspaces.id, workspaceId));
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, workspaceId));
}

// ── Members ────────────────────────────────────────────────────────────────
export interface MemberRow {
	userId: string;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	role: WorkspaceRole;
}

export async function listMembers(workspaceId: string): Promise<MemberRow[]> {
	return db
		.select({
			userId: schema.users.id,
			username: schema.users.username,
			displayName: schema.users.displayName,
			avatarUrl: schema.users.avatarUrl,
			role: schema.workspaceMembers.role
		})
		.from(schema.workspaceMembers)
		.innerJoin(schema.users, eq(schema.workspaceMembers.userId, schema.users.id))
		.where(eq(schema.workspaceMembers.workspaceId, workspaceId))
		.orderBy(asc(schema.users.displayName));
}

// ── Overview ─────────────────────────────────────────────────────────────────
export interface WorkspaceStats {
	projects: number;
	members: number;
	openTickets: number;
}

/** Headline counts for the workspace landing page (portable across dialects). */
export async function getWorkspaceStats(workspaceId: string): Promise<WorkspaceStats> {
	const [projects, members, openTickets] = await Promise.all([
		db.select({ n: count() }).from(schema.projects).where(eq(schema.projects.workspaceId, workspaceId)),
		db
			.select({ n: count() })
			.from(schema.workspaceMembers)
			.where(eq(schema.workspaceMembers.workspaceId, workspaceId)),
		db
			.select({ n: count() })
			.from(schema.tickets)
			.innerJoin(schema.projects, eq(schema.tickets.projectId, schema.projects.id))
			.where(and(eq(schema.projects.workspaceId, workspaceId), isNull(schema.tickets.closedAt)))
	]);
	return { projects: projects[0].n, members: members[0].n, openTickets: openTickets[0].n };
}

/** Project counts keyed by workspace id (for the dashboard cards). */
export async function countProjectsByWorkspace(
	workspaceIds: string[]
): Promise<Record<string, number>> {
	if (!workspaceIds.length) return {};
	const rows = await db
		.select({ ws: schema.projects.workspaceId, n: count() })
		.from(schema.projects)
		.where(inArray(schema.projects.workspaceId, workspaceIds))
		.groupBy(schema.projects.workspaceId);
	const map: Record<string, number> = {};
	for (const r of rows) map[r.ws] = r.n;
	return map;
}

export async function setMemberRole(
	workspaceId: string,
	userId: string,
	role: WorkspaceRole
): Promise<void> {
	await db
		.insert(schema.workspaceMembers)
		.values({ workspaceId, userId, role })
		.onConflictDoUpdate({
			target: [schema.workspaceMembers.workspaceId, schema.workspaceMembers.userId],
			set: { role }
		});
}

export async function removeMember(workspaceId: string, userId: string): Promise<void> {
	await db
		.delete(schema.workspaceMembers)
		.where(
			and(
				eq(schema.workspaceMembers.workspaceId, workspaceId),
				eq(schema.workspaceMembers.userId, userId)
			)
		);
}
