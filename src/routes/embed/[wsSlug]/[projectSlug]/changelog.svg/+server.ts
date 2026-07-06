import { error } from '@sveltejs/kit';
import { changelogSvg, svgResponse } from '$lib/server/embed-svg';
import { getBySlugs } from '$lib/server/services/projects';
import { listReleases } from '$lib/server/services/releases';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const ctx = await getBySlugs(locals.user, params.wsSlug, params.projectSlug);
	if (!ctx || ctx.visibility !== 'public') throw error(404, 'Not found');

	const releases = await listReleases(ctx.project.id, { publishedOnly: true });
	return svgResponse(
		changelogSvg(
			ctx.project.name,
			releases.map((r) => ({ version: r.version, name: r.name, releasedAt: r.releasedAt }))
		)
	);
};
