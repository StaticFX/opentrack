import { error } from '@sveltejs/kit';
import { ACCESS } from '$lib/server/permissions';
import { listProjectActivity } from '$lib/server/services/activity';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;
const MAX_LIMIT = 500;

export const load: PageServerLoad = async ({ parent, url }) => {
	const p = await parent();
	if (p.projectLevel < ACCESS.VIEWER) throw error(403, 'Members only');

	// `?limit=` grows with "Load more" — a plain re-query from the top rather
	// than a real SQL OFFSET, so it stays a single portable `listProjectActivity`
	// call with no dialect-specific pagination.
	const requested = Number(url.searchParams.get('limit'));
	const limit = Number.isFinite(requested) && requested > 0 ? Math.min(Math.floor(requested), MAX_LIMIT) : PAGE_SIZE;

	const items = await listProjectActivity(p.project.id, limit + 1);
	const hasMore = items.length > limit;

	return { activity: items.slice(0, limit), limit, hasMore };
};
