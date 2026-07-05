import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { listBoardTickets } from '$lib/server/services/tickets';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const p = await parent();
	const boards = await listBoards(p.project.id);
	const board = boards[0];
	if (!board) return { columns: [] };

	const [columns, tickets] = await Promise.all([
		getBoardColumns(board.id),
		listBoardTickets(board.id)
	]);
	// Public view: only tickets whose effective visibility resolves to public.
	const isPublic = p.effectiveVisibility === 'public';
	const publicTickets = tickets.filter((t) => isPublic && t.visibility !== 'private');

	return {
		columns: columns.map((c) => ({
			id: c.id,
			name: c.name,
			color: c.color,
			icon: c.icon,
			tickets: publicTickets.filter((t) => t.columnId === c.id)
		}))
	};
};
