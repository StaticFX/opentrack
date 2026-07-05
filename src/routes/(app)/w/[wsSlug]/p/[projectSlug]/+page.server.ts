import { listProjectActivity } from '$lib/server/services/activity';
import { getProjectStats, listMembers } from '$lib/server/services/projects';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	// The project overview: headline stats, boards, members, and recent activity.
	// (The board layout already loaded the project + boards into parent data.)
	const { project } = await parent();
	const [stats, members, activity] = await Promise.all([
		getProjectStats(project.id),
		listMembers(project.id),
		listProjectActivity(project.id, 12)
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
		activity
	};
};
