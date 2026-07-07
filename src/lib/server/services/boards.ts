import { asc, eq } from 'drizzle-orm';
import type { ColumnCategory } from '$lib/constants';
import { db, schema, type Tx } from '$lib/server/db';
import { initialRanks, rankAfter } from '$lib/server/util/rank';

export type Board = typeof schema.boards.$inferSelect;
export type BoardColumn = typeof schema.boardColumns.$inferSelect;

/** Columns seeded into every new board. */
const DEFAULT_COLUMNS: Array<{
	name: string;
	category: ColumnCategory;
	color: string;
	icon: string;
	isDefault?: boolean;
}> = [
	{ name: 'Backlog', category: 'backlog', color: '#94a3b8', icon: 'inbox' },
	{ name: 'Todo', category: 'todo', color: '#3b82f6', icon: 'circle', isDefault: true },
	{ name: 'In Progress', category: 'in_progress', color: '#f59e0b', icon: 'timer' },
	{ name: 'Done', category: 'done', color: '#22c55e', icon: 'circle-check-big' }
];

/** Create a board plus its default columns. Runs inside a transaction. */
export async function createBoardWithDefaults(
	tx: Tx,
	projectId: string,
	name = 'Board'
): Promise<Board> {
	const [board] = await tx
		.insert(schema.boards)
		.values({ projectId, name, position: rankAfter(null) })
		.returning();

	const ranks = initialRanks(DEFAULT_COLUMNS.length);
	await tx.insert(schema.boardColumns).values(
		DEFAULT_COLUMNS.map((c, i) => ({
			boardId: board.id,
			name: c.name,
			category: c.category,
			color: c.color,
			icon: c.icon,
			isDefault: c.isDefault ?? false,
			position: ranks[i]
		}))
	);

	return board;
}

export async function listBoards(projectId: string): Promise<Board[]> {
	return db
		.select()
		.from(schema.boards)
		.where(eq(schema.boards.projectId, projectId))
		.orderBy(asc(schema.boards.position));
}

export async function getBoardColumns(boardId: string): Promise<BoardColumn[]> {
	return db
		.select()
		.from(schema.boardColumns)
		.where(eq(schema.boardColumns.boardId, boardId))
		.orderBy(asc(schema.boardColumns.position));
}

/**
 * Set the public-roadmap lane override for a board's columns. `lanes` maps a
 * column id to a lane key (`planned`/`in_progress`/`shipped`/`hidden`) or null
 * to fall back to the column's category default. Only columns on `boardId` are
 * touched; ids not present in the map are left unchanged.
 */
export async function setColumnRoadmapLanes(
	boardId: string,
	lanes: Record<string, string | null>
): Promise<void> {
	const cols = await db
		.select({ id: schema.boardColumns.id })
		.from(schema.boardColumns)
		.where(eq(schema.boardColumns.boardId, boardId));
	const onBoard = new Set(cols.map((c) => c.id));
	for (const [id, lane] of Object.entries(lanes)) {
		if (!onBoard.has(id)) continue;
		await db
			.update(schema.boardColumns)
			.set({ roadmapLane: lane })
			.where(eq(schema.boardColumns.id, id));
	}
}
