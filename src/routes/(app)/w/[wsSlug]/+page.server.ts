import { listWorkspaceActivity } from '$lib/server/services/activity';
import { getWorkspaceStats, listMembers } from '$lib/server/services/workspaces';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	// The workspace layout already resolved + access-checked the workspace.
	const { workspace } = await parent();
	const [stats, members, activity] = await Promise.all([
		getWorkspaceStats(workspace.id),
		listMembers(workspace.id),
		listWorkspaceActivity(workspace.id, 12)
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
