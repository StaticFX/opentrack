import { error } from '@sveltejs/kit';
import { resolveEmbedConfig } from '$lib/embeds';
import { buildRoadmapLanes } from '$lib/roadmap';
import { roadmapSvg, svgResponse, themeParam } from '$lib/server/embed-svg';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { getBySlugs } from '$lib/server/services/projects';
import { listBoardTickets } from '$lib/server/services/tickets';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, url }) => {
	const ctx = await getBySlugs(locals.user, params.wsSlug, params.projectSlug);
	if (!ctx || ctx.visibility !== 'public' || !ctx.project.roadmapEnabled) throw error(404, 'Not found');

	const cfg = resolveEmbedConfig(ctx.project.embedConfig).roadmap;
	if (!cfg.enabled) throw error(404, 'Not found');
	// A static image can't be `auto`; the README <picture> passes ?theme=dark.
	const paramTheme = url.searchParams.get('theme');
	const theme = paramTheme ? themeParam(paramTheme) : cfg.theme === 'dark' ? 'dark' : 'light';

	const [board] = await listBoards(ctx.project.id);
	let lanes: ReturnType<typeof buildRoadmapLanes> = [];
	if (board) {
		const [columns, tickets] = await Promise.all([getBoardColumns(board.id), listBoardTickets(board.id)]);
		lanes = buildRoadmapLanes(columns, tickets, true);
	}
	lanes = lanes.filter((l) => cfg.lanes.includes(l.key)).map((l) => ({ ...l, items: l.items.slice(0, cfg.limit) }));
	return svgResponse(roadmapSvg(ctx.project.name, lanes, theme));
};
