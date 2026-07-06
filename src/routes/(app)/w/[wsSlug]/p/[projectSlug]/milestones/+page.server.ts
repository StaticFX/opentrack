import { listMilestones } from '$lib/server/services/milestones';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const p = await parent();
	const milestones = await listMilestones(p.project.id);
	return {
		projectId: p.project.id,
		canManage: p.canManageProject,
		githubRepo: p.project.githubRepo as string | null,
		milestones: milestones.map((m) => ({
			id: m.id,
			title: m.title,
			description: m.description,
			state: m.state,
			dueDate: m.dueDate,
			githubMilestoneNumber: m.githubMilestoneNumber,
			openCount: m.openCount,
			closedCount: m.closedCount
		}))
	};
};
