import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { ProjectRole, Visibility, WorkspaceRole } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import {
	ACCESS,
	PROJECT_ROLE_TO_ACCESS,
	getProjectRole,
	getWorkspaceRole,
	resolveVisibility,
	workspaceAccess,
	type AccessLevel
} from '$lib/server/permissions';
import { rankAfter } from '$lib/server/util/rank';
import { slugify } from '$lib/server/util/slug';
import { createBoardWithDefaults } from './boards';
import type { Workspace } from './workspaces';

export type Project = typeof schema.projects.$inferSelect;

export interface ProjectListing {
	project: Project;
	level: AccessLevel;
	visibility: 'public' | 'private';
}

/** Projects in a workspace the user can view, with effective access/visibility. */
export async function listForWorkspace(
	user: SessionUser | null,
	workspace: Workspace,
	wsRole: WorkspaceRole | null
): Promise<ProjectListing[]> {
	const projects = await db
		.select()
		.from(schema.projects)
		.where(eq(schema.projects.workspaceId, workspace.id))
		.orderBy(asc(schema.projects.position));
	if (projects.length === 0) return [];

	const wsAccess = workspaceAccess(user, workspace, wsRole);
	const roleByProject = new Map<string, ProjectRole>();
	if (user) {
		const rows = await db
			.select({ projectId: schema.projectMembers.projectId, role: schema.projectMembers.role })
			.from(schema.projectMembers)
			.where(
				and(
					eq(schema.projectMembers.userId, user.id),
					inArray(
						schema.projectMembers.projectId,
						projects.map((p) => p.id)
					)
				)
			);
		for (const r of rows) roleByProject.set(r.projectId, r.role);
	}

	return projects
		.map((project) => {
			const projRole = roleByProject.get(project.id) ?? null;
			const level = Math.max(
				wsAccess,
				projRole ? PROJECT_ROLE_TO_ACCESS[projRole] : ACCESS.NONE
			) as AccessLevel;
			const visibility = resolveVisibility([workspace.visibility, project.visibility]);
			return { project, level, visibility };
		})
		.filter((p) => p.level >= ACCESS.VIEWER || p.visibility === 'public');
}

export async function ensureUniqueSlug(
	workspaceId: string,
	desired: string,
	excludeId?: string
): Promise<string> {
	const base = slugify(desired);
	for (let i = 0; ; i++) {
		const candidate = i === 0 ? base : `${base}-${i + 1}`;
		const [existing] = await db
			.select({ id: schema.projects.id })
			.from(schema.projects)
			.where(and(eq(schema.projects.workspaceId, workspaceId), eq(schema.projects.slug, candidate)))
			.limit(1);
		if (!existing || existing.id === excludeId) return candidate;
	}
}

export interface CreateProjectInput {
	name: string;
	slug?: string;
	description?: string;
	color?: string;
	icon?: string;
	visibility?: Visibility;
}

/** Create a project, add the creator as maintainer, and seed a default board. */
export async function createProject(
	user: SessionUser,
	workspace: Workspace,
	input: CreateProjectInput
): Promise<Project> {
	const slug = await ensureUniqueSlug(workspace.id, input.slug || input.name);
	return db.transaction(async (tx) => {
		const [last] = await tx
			.select({ position: schema.projects.position })
			.from(schema.projects)
			.where(eq(schema.projects.workspaceId, workspace.id))
			.orderBy(desc(schema.projects.position))
			.limit(1);

		const [project] = await tx
			.insert(schema.projects)
			.values({
				workspaceId: workspace.id,
				slug,
				name: input.name,
				description: input.description ?? null,
				color: input.color ?? null,
				icon: input.icon ?? null,
				visibility: input.visibility ?? 'inherit',
				position: rankAfter(last?.position ?? null)
			})
			.returning();

		await tx
			.insert(schema.projectMembers)
			.values({ projectId: project.id, userId: user.id, role: 'maintainer' });
		await createBoardWithDefaults(tx, project.id, 'Board');
		return project;
	});
}

export interface ProjectContext {
	project: Project;
	workspace: Workspace;
	wsRole: WorkspaceRole | null;
	projRole: ProjectRole | null;
	level: AccessLevel;
	visibility: 'public' | 'private';
}

/** Load a project by workspace + project slug with the user's effective access. */
export async function getBySlugs(
	user: SessionUser | null,
	wsSlug: string,
	projectSlug: string
): Promise<ProjectContext | null> {
	const [row] = await db
		.select({ project: schema.projects, workspace: schema.workspaces })
		.from(schema.projects)
		.innerJoin(schema.workspaces, eq(schema.projects.workspaceId, schema.workspaces.id))
		.where(and(eq(schema.workspaces.slug, wsSlug), eq(schema.projects.slug, projectSlug)))
		.limit(1);
	if (!row) return null;

	let wsRole: WorkspaceRole | null = null;
	let projRole: ProjectRole | null = null;
	if (user) {
		wsRole = await getWorkspaceRole(user.id, row.workspace.id);
		projRole = await getProjectRole(user.id, row.project.id);
	}
	let level = workspaceAccess(user, row.workspace, wsRole);
	if (projRole) level = Math.max(level, PROJECT_ROLE_TO_ACCESS[projRole]) as AccessLevel;

	return {
		project: row.project,
		workspace: row.workspace,
		wsRole,
		projRole,
		level,
		visibility: resolveVisibility([row.workspace.visibility, row.project.visibility])
	};
}

export interface UpdateProjectInput {
	name?: string;
	description?: string | null;
	color?: string | null;
	icon?: string | null;
	visibility?: Visibility;
	allowPublicComments?: boolean;
	roadmapEnabled?: boolean;
	githubProgressLabels?: string[] | null;
	githubCloseColumns?: string[] | null;
}

export async function updateProject(projectId: string, patch: UpdateProjectInput): Promise<void> {
	await db
		.update(schema.projects)
		.set({
			...(patch.name !== undefined ? { name: patch.name } : {}),
			...(patch.description !== undefined ? { description: patch.description } : {}),
			...(patch.color !== undefined ? { color: patch.color } : {}),
			...(patch.icon !== undefined ? { icon: patch.icon } : {}),
			...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
			...(patch.allowPublicComments !== undefined
				? { allowPublicComments: patch.allowPublicComments }
				: {}),
			...(patch.roadmapEnabled !== undefined ? { roadmapEnabled: patch.roadmapEnabled } : {}),
			...(patch.githubProgressLabels !== undefined
				? { githubProgressLabels: patch.githubProgressLabels }
				: {}),
			...(patch.githubCloseColumns !== undefined
				? { githubCloseColumns: patch.githubCloseColumns }
				: {}),
			updatedAt: new Date()
		})
		.where(eq(schema.projects.id, projectId));
}

export async function deleteProject(projectId: string): Promise<void> {
	await db.transaction(async (tx) => {
		// `activity.project_id` was added by a later migration via ALTER TABLE, so
		// its FK has no ON DELETE CASCADE (SQLite can't attach one that way). Clear
		// those rows first, otherwise deleting a project that has activity fails
		// with a foreign-key constraint error. Everything else cascades.
		await tx.delete(schema.activity).where(eq(schema.activity.projectId, projectId));
		await tx.delete(schema.projects).where(eq(schema.projects.id, projectId));
	});
}

// ── Members ────────────────────────────────────────────────────────────────
export interface ProjectMemberRow {
	userId: string;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	role: ProjectRole;
}

export async function listMembers(projectId: string): Promise<ProjectMemberRow[]> {
	return db
		.select({
			userId: schema.users.id,
			username: schema.users.username,
			displayName: schema.users.displayName,
			avatarUrl: schema.users.avatarUrl,
			role: schema.projectMembers.role
		})
		.from(schema.projectMembers)
		.innerJoin(schema.users, eq(schema.projectMembers.userId, schema.users.id))
		.where(eq(schema.projectMembers.projectId, projectId))
		.orderBy(asc(schema.users.displayName));
}

export async function setMemberRole(
	projectId: string,
	userId: string,
	role: ProjectRole
): Promise<void> {
	await db
		.insert(schema.projectMembers)
		.values({ projectId, userId, role })
		.onConflictDoUpdate({
			target: [schema.projectMembers.projectId, schema.projectMembers.userId],
			set: { role }
		});
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
	await db
		.delete(schema.projectMembers)
		.where(
			and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, userId))
		);
}

// ── Overview ─────────────────────────────────────────────────────────────────
export interface ProjectStats {
	openTickets: number;
	totalTickets: number;
	boards: number;
	suggestions: number;
	releases: number;
	members: number;
}

/**
 * Headline counts for a project's overview page. Each is an independent COUNT
 * (portable across both dialects) run in parallel — an open ticket is one whose
 * `closedAt` is null.
 */
export async function getProjectStats(projectId: string): Promise<ProjectStats> {
	const [openTickets, totalTickets, boards, suggestions, releases, members] = await Promise.all([
		db
			.select({ n: count() })
			.from(schema.tickets)
			.where(and(eq(schema.tickets.projectId, projectId), isNull(schema.tickets.closedAt))),
		db.select({ n: count() }).from(schema.tickets).where(eq(schema.tickets.projectId, projectId)),
		db.select({ n: count() }).from(schema.boards).where(eq(schema.boards.projectId, projectId)),
		db
			.select({ n: count() })
			.from(schema.suggestions)
			.where(eq(schema.suggestions.projectId, projectId)),
		db.select({ n: count() }).from(schema.releases).where(eq(schema.releases.projectId, projectId)),
		db
			.select({ n: count() })
			.from(schema.projectMembers)
			.where(eq(schema.projectMembers.projectId, projectId))
	]);

	return {
		openTickets: openTickets[0].n,
		totalTickets: totalTickets[0].n,
		boards: boards[0].n,
		suggestions: suggestions[0].n,
		releases: releases[0].n,
		members: members[0].n
	};
}
