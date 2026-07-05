import { error } from '@sveltejs/kit';
import { ACCESS } from '$lib/server/permissions';
import { listProjectActivity } from '$lib/server/services/activity';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const p = await parent();
	if (p.projectLevel < ACCESS.VIEWER) throw error(403, 'Members only');
	return { activity: await listProjectActivity(p.project.id) };
};
