import { listMultiWorkspaceActivity } from '$lib/server/services/activity';
import { countOpenAssignedTo } from '$lib/server/services/tickets';
import { countProjectsByWorkspace } from '$lib/server/services/workspaces';
import { listAssignedTo, listDueSoon } from '$lib/server/services/mywork';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	// The (app) layout already resolved the user's visible workspaces.
	const { workspaces } = await parent();
	const ids = workspaces.map((w) => w.id);

	const [projectCounts, assignedOpen, activity, assigned, dueSoon] = await Promise.all([
		countProjectsByWorkspace(ids),
		locals.user ? countOpenAssignedTo(locals.user.id) : Promise.resolve(0),
		listMultiWorkspaceActivity(ids, 15),
		locals.user ? listAssignedTo(locals.user) : Promise.resolve([]),
		locals.user ? listDueSoon(locals.user, 7) : Promise.resolve([])
	]);

	const totalProjects = Object.values(projectCounts).reduce((a, b) => a + b, 0);

	return {
		projectCounts,
		activity,
		// Contributor-focused work surfaced on the dashboard (capped for a compact view).
		assigned: assigned.slice(0, 6),
		dueSoon: dueSoon.slice(0, 6),
		stats: {
			workspaces: workspaces.length,
			projects: totalProjects,
			assignedOpen,
			dueSoonCount: dueSoon.length
		}
	};
};
