import { error } from '@sveltejs/kit';
import { getBoardColumns } from '$lib/server/services/boards';
import { listFields } from '$lib/server/services/custom-fields';
import { listLabels } from '$lib/server/services/labels';
import { listBoardTickets } from '$lib/server/services/tickets';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params, depends, url }) => {
	const data = await parent();
	const board = data.boards.find((b) => b.id === params.boardId);
	if (!board) throw error(404, 'Board not found');

	// Lets SSE-driven `invalidate('board:<id>')` re-run just this load.
	depends(`board:${params.boardId}`);

	const showArchived = url.searchParams.get('archived') === '1';
	const [columns, tickets, labels, fields] = await Promise.all([
		getBoardColumns(params.boardId),
		listBoardTickets(params.boardId, showArchived),
		listLabels(data.project.id),
		listFields(data.project.id)
	]);

	return {
		board,
		showArchived,
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
		labels,
		fields
	};
};
