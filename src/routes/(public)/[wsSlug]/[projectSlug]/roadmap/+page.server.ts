import { buildRoadmapLanes } from '$lib/roadmap';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { listBoardTickets } from '$lib/server/services/tickets';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const p = await parent();
	const boards = await listBoards(p.project.id);
	const board = boards[0];
	if (!board) return { lanes: [] };

	const [columns, tickets] = await Promise.all([
		getBoardColumns(board.id),
		listBoardTickets(board.id)
	]);

	const lanes = buildRoadmapLanes(columns, tickets, p.effectiveVisibility === 'public');
	return { lanes };
};
