import { error } from '@sveltejs/kit';
import { resolveEmbedConfig } from '$lib/embeds';
import { env } from '$lib/server/env';
import { getBySlugs } from '$lib/server/services/projects';
import { listSuggestions } from '$lib/server/services/suggestions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const ctx = await getBySlugs(locals.user, params.wsSlug, params.projectSlug);
	if (!ctx || ctx.visibility !== 'public') throw error(404, 'Not found');

	const cfg = resolveEmbedConfig(ctx.project.embedConfig).feedback;
	if (!cfg.enabled) throw error(404, 'Not found');

	const { cards } = await listSuggestions(ctx.project.id, { publicOnly: true, sort: 'top' });
	return {
		project: { name: ctx.project.name },
		href: `${env.origin}/${params.wsSlug}/${params.projectSlug}/suggestions`,
		items: cards.slice(0, cfg.limit).map((c) => ({
			id: c.id,
			title: c.title,
			votes: c.votes,
			kind: c.kind,
			status: c.status
		})),
		embed: {
			theme: cfg.theme,
			accent: cfg.accent ?? ctx.project.color,
			showHeader: cfg.showHeader,
			showFooter: cfg.showFooter
		}
	};
};
