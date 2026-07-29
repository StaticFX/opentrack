import { listMultiWorkspaceActivity } from '$lib/server/services/activity';
import { countOpenAssignedTo } from '$lib/server/services/tickets';
import { countProjectsByWorkspace } from '$lib/server/services/workspaces';
import { listAssignedTo, listDueSoon } from '$lib/server/services/mywork';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	// The (app) layout already resolved the user's visible workspaces.
	const { workspaces } = await parent();
	const ids = workspaces.map((w) => w.id);

	const [projectCounts, assignedOpen, activityFeed, assigned, dueSoon] = await Promise.all([
		countProjectsByWorkspace(ids),
		locals.user ? countOpenAssignedTo(locals.user.id) : Promise.resolve(0),
		// Widened past the rail's own render limit (12) so the workspace-grid
		// "last active" vitals below have decent coverage across quiet workspaces.
		listMultiWorkspaceActivity(ids, 40),
		locals.user ? listAssignedTo(locals.user) : Promise.resolve([]),
		locals.user ? listDueSoon(locals.user, 7) : Promise.resolve([])
	]);

	const totalProjects = Object.values(projectCounts).reduce((a, b) => a + b, 0);

	// dueSoon is already a subset of assigned (see mywork.ts) — surface the
	// soonest-due first, then fill the top-5 "needs you" preview from the
	// wider assigned set, deduped.
	const seen = new Set<string>();
	const topWork = [...dueSoon, ...assigned]
		.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
		.slice(0, 5);

	const wsIdBySlug = new Map(workspaces.map((w) => [w.slug, w.id]));
	const lastActivityAt: Record<string, string> = {};
	for (const a of activityFeed) {
		const wsId = a.workspaceSlug ? wsIdBySlug.get(a.workspaceSlug) : undefined;
		// Feed is newest-first — the first hit per workspace is its latest.
		if (wsId && !(wsId in lastActivityAt)) lastActivityAt[wsId] = new Date(a.createdAt).toISOString();
	}

	return {
		projectCounts,
		lastActivityAt,
		activity: activityFeed.slice(0, 12),
		topWork,
		stats: {
			workspaces: workspaces.length,
			projects: totalProjects,
			assignedOpen,
			dueSoonCount: dueSoon.length
		}
	};
};
