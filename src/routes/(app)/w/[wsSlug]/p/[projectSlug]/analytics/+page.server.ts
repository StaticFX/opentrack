import { error } from '@sveltejs/kit';
import { ACCESS } from '$lib/server/permissions';
import { getProjectAnalytics } from '$lib/server/services/analytics';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const p = await parent();
	if (p.projectLevel < ACCESS.VIEWER) throw error(403, 'Members only');
	return { analytics: await getProjectAnalytics(p.project.id) };
};
