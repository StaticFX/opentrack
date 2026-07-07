import { error } from '@sveltejs/kit';
import { buildRoadmapLanes } from '$lib/roadmap';
import { roadmapSvg, svgResponse, themeParam } from '$lib/server/embed-svg';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { getBySlugs } from '$lib/server/services/projects';
import { listBoardTickets } from '$lib/server/services/tickets';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, url }) => {
	const ctx = await getBySlugs(locals.user, params.wsSlug, params.projectSlug);
	if (!ctx || ctx.visibility !== 'public' || !ctx.project.roadmapEnabled) throw error(404, 'Not found');

	const [board] = await listBoards(ctx.project.id);
	let lanes: ReturnType<typeof buildRoadmapLanes> = [];
	if (board) {
		const [columns, tickets] = await Promise.all([getBoardColumns(board.id), listBoardTickets(board.id)]);
		lanes = buildRoadmapLanes(columns, tickets, true);
	}
	return svgResponse(roadmapSvg(ctx.project.name, lanes, themeParam(url.searchParams.get('theme'))));
};
