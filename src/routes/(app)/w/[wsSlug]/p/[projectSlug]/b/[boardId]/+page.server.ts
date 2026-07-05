import { error } from '@sveltejs/kit';
import { getBoardColumns } from '$lib/server/services/boards';
import { listLabels } from '$lib/server/services/labels';
import { listBoardTickets } from '$lib/server/services/tickets';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params, depends }) => {
	const data = await parent();
	const board = data.boards.find((b) => b.id === params.boardId);
	if (!board) throw error(404, 'Board not found');

	// Lets SSE-driven `invalidate('board:<id>')` re-run just this load.
	depends(`board:${params.boardId}`);

	const [columns, tickets, labels] = await Promise.all([
		getBoardColumns(params.boardId),
		listBoardTickets(params.boardId),
		listLabels(data.project.id)
	]);

	return {
		board,
		columns: columns.map((c) => ({
			id: c.id,
			name: c.name,
			color: c.color,
			icon: c.icon,
			category: c.category,
			wipLimit: c.wipLimit,
			position: c.position
		})),
		tickets,
		labels
	};
};
