import { getBoardColumns } from '$lib/server/services/boards';
import { listBoardTickets } from '$lib/server/services/tickets';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, depends }) => {
	const p = await parent();
	if (!p.boardId) return { columns: [] };
	depends(`board:${p.boardId}`);

	const [columns, tickets] = await Promise.all([
		getBoardColumns(p.boardId),
		listBoardTickets(p.boardId)
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
