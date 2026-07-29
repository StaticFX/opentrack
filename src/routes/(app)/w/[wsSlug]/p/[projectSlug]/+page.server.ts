import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { listProjectActivity } from '$lib/server/services/activity';
import { bucketWeekly } from '$lib/server/services/analytics';
import { getProjectStats, listMembers } from '$lib/server/services/projects';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	// The project overview: headline stats, boards, members, and recent activity.
	// (The board layout already loaded the project + boards into parent data.)
	const { project } = await parent();
	const now = new Date();
	const [stats, members, activity, ticketRows, suggestionRows, releaseRows] = await Promise.all([
		getProjectStats(project.id),
		listMembers(project.id),
		listProjectActivity(project.id, 12),
		db
			.select({ createdAt: schema.tickets.createdAt, closedAt: schema.tickets.closedAt })
			.from(schema.tickets)
			.where(eq(schema.tickets.projectId, project.id)),
		db
			.select({ createdAt: schema.suggestions.createdAt })
			.from(schema.suggestions)
			.where(eq(schema.suggestions.projectId, project.id)),
		db
			.select({ createdAt: schema.releases.createdAt })
			.from(schema.releases)
			.where(eq(schema.releases.projectId, project.id))
	]);

	// 7-week creation trend per StatTile — portable JS bucketing (no dialect
	// date SQL), reusing the same pure bucketer analytics/public pulses share.
	const spark = (rows: { createdAt: Date }[]) =>
		bucketWeekly(
			rows.map((r) => ({ createdAt: r.createdAt, closedAt: null })),
			now,
			7
		).map((w) => w.opened);

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
		openSpark: spark(ticketRows),
		triageSpark: spark(suggestionRows),
		releaseSpark: spark(releaseRows)
	};
};
