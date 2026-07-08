import { error } from '@sveltejs/kit';
import { BADGE_METRIC_LABELS, resolveEmbedConfig } from '$lib/embeds';
import { badgeSvg, svgResponse, themeParam } from '$lib/server/embed-svg';
import { getBySlugs } from '$lib/server/services/projects';
import { listReleases } from '$lib/server/services/releases';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, url }) => {
	const ctx = await getBySlugs(locals.user, params.wsSlug, params.projectSlug);
	if (!ctx || ctx.visibility !== 'public') throw error(404, 'Not found');

	const cfg = resolveEmbedConfig(ctx.project.embedConfig).badge;
	if (!cfg.enabled) throw error(404, 'Not found');
	const paramTheme = url.searchParams.get('theme');
	const theme = paramTheme ? themeParam(paramTheme) : cfg.theme === 'dark' ? 'dark' : 'light';

	const releases = await listReleases(ctx.project.id, { publishedOnly: true });
	const value = cfg.metric === 'release' ? (releases[0]?.version ?? 'none') : String(releases.length);
	const label = cfg.label.trim() || BADGE_METRIC_LABELS[cfg.metric];
	return svgResponse(badgeSvg(label, value, theme, ctx.project.color));
};
