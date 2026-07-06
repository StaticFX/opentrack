import { error } from '@sveltejs/kit';
import { env } from '$lib/server/env';
import { getBySlugs } from '$lib/server/services/projects';
import { listReleases } from '$lib/server/services/releases';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const ctx = await getBySlugs(locals.user, params.wsSlug, params.projectSlug);
	if (!ctx || ctx.visibility !== 'public') throw error(404, 'Not found');

	const releases = await listReleases(ctx.project.id, { publishedOnly: true });
	return {
		project: { name: ctx.project.name },
		href: `${env.origin}/${params.wsSlug}/${params.projectSlug}/releases`,
		releases: releases.slice(0, 8).map((r) => ({
			version: r.version,
			name: r.name,
			releasedAt: r.releasedAt
		}))
	};
};
