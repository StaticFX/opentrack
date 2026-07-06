import { error } from '@sveltejs/kit';
import { renderMarkdown } from '$lib/markdown';
import { renderRss, xmlResponse } from '$lib/server/feed';
import { env } from '$lib/server/env';
import { ACCESS } from '$lib/server/permissions';
import { getBySlugs } from '$lib/server/services/projects';
import { getReleaseDetail, listReleases } from '$lib/server/services/releases';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const ctx = await getBySlugs(locals.user, params.wsSlug, params.projectSlug);
	if (!ctx) throw error(404, 'Not found');
	if (ctx.level === ACCESS.NONE && ctx.visibility !== 'public') throw error(404, 'Not found');

	const base = `${env.origin}/${params.wsSlug}/${params.projectSlug}`;
	const published = await listReleases(ctx.project.id, { publishedOnly: true });
	const details = (await Promise.all(published.map((r) => getReleaseDetail(r.id)))).filter(Boolean);

	const feed = renderRss({
		title: `${ctx.project.name} — Releases`,
		link: `${base}/releases`,
		description: `Changelog for ${ctx.project.name}`,
		selfLink: `${base}/releases/rss.xml`,
		items: details.map((d) => ({
			title: d!.release.name ? `${d!.release.version} — ${d!.release.name}` : d!.release.version,
			link: `${base}/releases`,
			guid: d!.release.id,
			date: d!.release.releasedAt,
			html: d!.release.notes ? renderMarkdown(d!.release.notes) : undefined
		}))
	});
	return xmlResponse(feed);
};
