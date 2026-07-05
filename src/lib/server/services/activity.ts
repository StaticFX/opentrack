import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';

export interface LogInput {
	projectId?: string | null;
	subjectType: string; // 'ticket' | 'suggestion' | 'release' | 'comment'
	subjectId: string;
	actorId?: string | null;
	type: string; // e.g. 'ticket.created', 'suggestion.status', 'release.published'
	data?: Record<string, unknown>;
}

/** Record an activity entry. Best-effort — failures never break the caller. */
export async function logActivity(input: LogInput): Promise<void> {
	try {
		await db.insert(schema.activity).values({
			projectId: input.projectId ?? null,
			subjectType: input.subjectType,
			subjectId: input.subjectId,
			actorId: input.actorId ?? null,
			type: input.type,
			data: input.data ?? null
		});
	} catch (err) {
		console.warn('[activity] log failed:', err);
	}
}

export interface ActivityItem {
	id: string;
	type: string;
	data: Record<string, unknown> | null;
	createdAt: Date;
	subjectType: string;
	subjectId: string;
	actorName: string | null;
	ticketNumber: number | null;
	ticketTitle: string | null;
	suggestionTitle: string | null;
	releaseVersion: string | null;
	/** Present on the workspace-wide feed so each item can name its project. */
	projectName?: string | null;
	projectSlug?: string | null;
	/** Present on the cross-workspace (dashboard) feed. */
	workspaceName?: string | null;
	workspaceSlug?: string | null;
}

/** Recent activity for a project, with subject titles resolved via joins. */
export async function listProjectActivity(projectId: string, limit = 60): Promise<ActivityItem[]> {
	return db
		.select({
			id: schema.activity.id,
			type: schema.activity.type,
			data: schema.activity.data,
			createdAt: schema.activity.createdAt,
			subjectType: schema.activity.subjectType,
			subjectId: schema.activity.subjectId,
			actorName: schema.users.displayName,
			ticketNumber: schema.tickets.number,
			ticketTitle: schema.tickets.title,
			suggestionTitle: schema.suggestions.title,
			releaseVersion: schema.releases.version
		})
		.from(schema.activity)
		.leftJoin(schema.users, eq(schema.activity.actorId, schema.users.id))
		.leftJoin(
			schema.tickets,
			and(eq(schema.activity.subjectType, 'ticket'), eq(schema.activity.subjectId, schema.tickets.id))
		)
		.leftJoin(
			schema.suggestions,
			and(eq(schema.activity.subjectType, 'suggestion'), eq(schema.activity.subjectId, schema.suggestions.id))
		)
		.leftJoin(
			schema.releases,
			and(eq(schema.activity.subjectType, 'release'), eq(schema.activity.subjectId, schema.releases.id))
		)
		.where(eq(schema.activity.projectId, projectId))
		.orderBy(desc(schema.activity.createdAt))
		.limit(limit) as Promise<ActivityItem[]>;
}

/** Recent activity across every project in a workspace, tagged with its project. */
export async function listWorkspaceActivity(
	workspaceId: string,
	limit = 12
): Promise<ActivityItem[]> {
	return db
		.select({
			id: schema.activity.id,
			type: schema.activity.type,
			data: schema.activity.data,
			createdAt: schema.activity.createdAt,
			subjectType: schema.activity.subjectType,
			subjectId: schema.activity.subjectId,
			actorName: schema.users.displayName,
			ticketNumber: schema.tickets.number,
			ticketTitle: schema.tickets.title,
			suggestionTitle: schema.suggestions.title,
			releaseVersion: schema.releases.version,
			projectName: schema.projects.name,
			projectSlug: schema.projects.slug
		})
		.from(schema.activity)
		.innerJoin(schema.projects, eq(schema.activity.projectId, schema.projects.id))
		.leftJoin(schema.users, eq(schema.activity.actorId, schema.users.id))
		.leftJoin(
			schema.tickets,
			and(eq(schema.activity.subjectType, 'ticket'), eq(schema.activity.subjectId, schema.tickets.id))
		)
		.leftJoin(
			schema.suggestions,
			and(eq(schema.activity.subjectType, 'suggestion'), eq(schema.activity.subjectId, schema.suggestions.id))
		)
		.leftJoin(
			schema.releases,
			and(eq(schema.activity.subjectType, 'release'), eq(schema.activity.subjectId, schema.releases.id))
		)
		.where(eq(schema.projects.workspaceId, workspaceId))
		.orderBy(desc(schema.activity.createdAt))
		.limit(limit) as Promise<ActivityItem[]>;
}

/** Recent activity across a set of workspaces, tagged with project + workspace. */
export async function listMultiWorkspaceActivity(
	workspaceIds: string[],
	limit = 15
): Promise<ActivityItem[]> {
	if (!workspaceIds.length) return [];
	return db
		.select({
			id: schema.activity.id,
			type: schema.activity.type,
			data: schema.activity.data,
			createdAt: schema.activity.createdAt,
			subjectType: schema.activity.subjectType,
			subjectId: schema.activity.subjectId,
			actorName: schema.users.displayName,
			ticketNumber: schema.tickets.number,
			ticketTitle: schema.tickets.title,
			suggestionTitle: schema.suggestions.title,
			releaseVersion: schema.releases.version,
			projectName: schema.projects.name,
			projectSlug: schema.projects.slug,
			workspaceName: schema.workspaces.name,
			workspaceSlug: schema.workspaces.slug
		})
		.from(schema.activity)
		.innerJoin(schema.projects, eq(schema.activity.projectId, schema.projects.id))
		.innerJoin(schema.workspaces, eq(schema.projects.workspaceId, schema.workspaces.id))
		.leftJoin(schema.users, eq(schema.activity.actorId, schema.users.id))
		.leftJoin(
			schema.tickets,
			and(eq(schema.activity.subjectType, 'ticket'), eq(schema.activity.subjectId, schema.tickets.id))
		)
		.leftJoin(
			schema.suggestions,
			and(eq(schema.activity.subjectType, 'suggestion'), eq(schema.activity.subjectId, schema.suggestions.id))
		)
		.leftJoin(
			schema.releases,
			and(eq(schema.activity.subjectType, 'release'), eq(schema.activity.subjectId, schema.releases.id))
		)
		.where(inArray(schema.projects.workspaceId, workspaceIds))
		.orderBy(desc(schema.activity.createdAt))
		.limit(limit) as Promise<ActivityItem[]>;
}
