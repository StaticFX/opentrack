import { asc, desc, eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { listWorkspaceActivity } from '$lib/server/services/activity';
import { bucketWeekly, type WeeklyPoint } from '$lib/server/services/analytics';
import { getWorkspaceStats, listMembers } from '$lib/server/services/workspaces';
import type { PageServerLoad } from './$types';

export interface ProjectVitals {
	openCount: number;
	/** 8 weekly opened/closed bins — same shape public/ProjectRow.svelte reads. */
	weekly: WeeklyPoint[];
	lastActivityAt: Date | null;
	avatars: { name: string; avatarUrl: string | null }[];
	memberCount: number;
}

/**
 * Per-project vitals for the workspace overview's project cards. Internal
 * (unfiltered) counterpart to `getProjectHeartbeat` in services/public.ts,
 * which only counts public-visibility tickets — members here see everything.
 * One small set of queries per project (same N+1 shape as that helper); the
 * workspace project list is small enough that this stays cheap and portable.
 */
async function getProjectVitals(projectId: string, now: Date): Promise<ProjectVitals> {
	const [ticketRows, memberRows, latest] = await Promise.all([
		db
			.select({ createdAt: schema.tickets.createdAt, closedAt: schema.tickets.closedAt })
			.from(schema.tickets)
			.where(eq(schema.tickets.projectId, projectId)),
		db
			.select({
				name: schema.users.displayName,
				avatarUrl: schema.users.avatarUrl
			})
			.from(schema.projectMembers)
			.innerJoin(schema.users, eq(schema.projectMembers.userId, schema.users.id))
			.where(eq(schema.projectMembers.projectId, projectId))
			.orderBy(asc(schema.users.displayName)),
		db
			.select({ createdAt: schema.activity.createdAt })
			.from(schema.activity)
			.where(eq(schema.activity.projectId, projectId))
			.orderBy(desc(schema.activity.createdAt))
			.limit(1)
	]);

	const closed = ticketRows.filter((r) => r.closedAt != null).length;
	return {
		openCount: ticketRows.length - closed,
		weekly: bucketWeekly(ticketRows, now, 8),
		lastActivityAt: latest[0]?.createdAt ?? null,
		avatars: memberRows.slice(0, 4).map((m) => ({ name: m.name, avatarUrl: m.avatarUrl })),
		memberCount: memberRows.length
	};
}

export const load: PageServerLoad = async ({ parent }) => {
	// The workspace layout already resolved + access-checked the workspace.
	const { workspace } = await parent();
	const now = new Date();

	const projectIds = await db
		.select({ id: schema.projects.id, slug: schema.projects.slug })
		.from(schema.projects)
		.where(eq(schema.projects.workspaceId, workspace.id));

	const [stats, members, activity, vitalsEntries] = await Promise.all([
		getWorkspaceStats(workspace.id),
		listMembers(workspace.id),
		listWorkspaceActivity(workspace.id, 12),
		Promise.all(
			projectIds.map(async (p) => [p.slug, await getProjectVitals(p.id, now)] as const)
		)
	]);

	return {
		stats,
		members: members.map((m) => ({
			userId: m.userId,
			displayName: m.displayName,
			username: m.username,
			avatarUrl: m.avatarUrl,
			role: m.role
		})),
		activity,
		/** Additive: per-project card vitals, keyed by project slug. */
		projectVitals: Object.fromEntries(vitalsEntries) as Record<string, ProjectVitals>
	};
};
