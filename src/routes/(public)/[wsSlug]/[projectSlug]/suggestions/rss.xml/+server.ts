import { error } from '@sveltejs/kit';
import { renderMarkdown } from '$lib/markdown';
import { renderRss, xmlResponse } from '$lib/server/feed';
import { env } from '$lib/server/env';
import { ACCESS } from '$lib/server/permissions';
import { getBySlugs } from '$lib/server/services/projects';
import { listSuggestions } from '$lib/server/services/suggestions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const ctx = await getBySlugs(locals.user, params.wsSlug, params.projectSlug);
	if (!ctx) throw error(404, 'Not found');
	if (ctx.level === ACCESS.NONE && ctx.visibility !== 'public') throw error(404, 'Not found');

	const base = `${env.origin}/${params.wsSlug}/${params.projectSlug}`;
	const { cards } = await listSuggestions(ctx.project.id, { sort: 'new', status: 'all', publicOnly: true });
	const recent = cards.slice(0, 30);

	const feed = renderRss({
		title: `${ctx.project.name} — Suggestions`,
		link: `${base}/suggestions`,
		description: `Latest suggestions for ${ctx.project.name}`,
		selfLink: `${base}/suggestions/rss.xml`,
		items: recent.map((s) => ({
			title: s.title,
			link: `${base}/suggestions/${s.id}`,
			guid: s.id,
			date: s.createdAt,
			html: s.body ? renderMarkdown(s.body) : undefined
		}))
	});
	return xmlResponse(feed);
};
