import { listMultiWorkspaceActivity } from '$lib/server/services/activity';
import { countOpenAssignedTo } from '$lib/server/services/tickets';
import { countProjectsByWorkspace } from '$lib/server/services/workspaces';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	// The (app) layout already resolved the user's visible workspaces.
	const { workspaces } = await parent();
	const ids = workspaces.map((w) => w.id);

	const [projectCounts, assignedOpen, activity] = await Promise.all([
		countProjectsByWorkspace(ids),
		locals.user ? countOpenAssignedTo(locals.user.id) : Promise.resolve(0),
		listMultiWorkspaceActivity(ids, 15)
	]);

	const totalProjects = Object.values(projectCounts).reduce((a, b) => a + b, 0);

	return {
		projectCounts,
		activity,
		stats: {
			workspaces: workspaces.length,
			projects: totalProjects,
			assignedOpen
		}
	};
};
