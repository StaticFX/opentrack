import { error } from '@sveltejs/kit';
import { resolveEmbedConfig } from '$lib/embeds';
import { buildRoadmapLanes } from '$lib/roadmap';
import { env } from '$lib/server/env';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { getBySlugs } from '$lib/server/services/projects';
import { listBoardTickets } from '$lib/server/services/tickets';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const ctx = await getBySlugs(locals.user, params.wsSlug, params.projectSlug);
	// Embeds are for public projects only, and only when the roadmap is enabled.
	if (!ctx || ctx.visibility !== 'public' || !ctx.project.roadmapEnabled) throw error(404, 'Not found');

	const cfg = resolveEmbedConfig(ctx.project.embedConfig).roadmap;
	if (!cfg.enabled) throw error(404, 'Not found');

	const boards = await listBoards(ctx.project.id);
	const board = boards[0];
	let lanes: ReturnType<typeof buildRoadmapLanes> = [];
	if (board) {
		const [columns, tickets] = await Promise.all([getBoardColumns(board.id), listBoardTickets(board.id)]);
		lanes = buildRoadmapLanes(columns, tickets, true);
	}
	// Honour the configured lanes + per-lane item cap.
	lanes = lanes
		.filter((l) => cfg.lanes.includes(l.key))
		.map((l) => ({ ...l, items: l.items.slice(0, cfg.limit) }));

	return {
		project: { name: ctx.project.name },
		href: `${env.origin}/${params.wsSlug}/${params.projectSlug}/roadmap`,
		lanes,
		embed: {
			theme: cfg.theme,
			accent: cfg.accent ?? ctx.project.color,
			showHeader: cfg.showHeader,
			showFooter: cfg.showFooter
		}
	};
};
