import { ACCESS } from '$lib/server/permissions';
import {
	getLatestRelease,
	getPublicPulse,
	listNowBuilding,
	listPublicActivity,
	listPublicContributors,
	listPublicMilestones,
	listRecentlyShipped,
	listTopIdeas
} from '$lib/server/services/public';
import { resolveVoter } from '$lib/server/util/anon';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, depends, locals, cookies, getClientAddress }) => {
	const p = await parent();
	const isPublic = p.effectiveVisibility === 'public';
	depends(`public:overview:${p.project.id}`);
	const voter = resolveVoter(locals.user, cookies, getClientAddress);

	const [pulse, shipped, nowBuilding, ideas, latestRelease, activity, milestones, contributors] =
		await Promise.all([
			getPublicPulse(p.project.id, isPublic),
			listRecentlyShipped(p.project.id, isPublic, 6),
			listNowBuilding(p.project.id, isPublic, 6),
			listTopIdeas(p.project.id, { includeHidden: p.level >= ACCESS.VIEWER, voter, limit: 5 }),
			p.hasReleases ? getLatestRelease(p.project.id) : Promise.resolve(null),
			listPublicActivity(p.project.id, isPublic, 14),
			listPublicMilestones(p.project.id, isPublic, 2),
			listPublicContributors(p.project.id)
		]);

	return { pulse, shipped, nowBuilding, ideas, latestRelease, activity, milestones, contributors };
};
