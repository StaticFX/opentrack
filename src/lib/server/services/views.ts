import { and, asc, eq, or } from 'drizzle-orm';
import { normalizeFilters, type BoardFilters } from '$lib/board';
import { db, schema } from '$lib/server/db';

/** The persisted filter shape (multi-value). See `$lib/board`. */
export type ViewFilters = BoardFilters;

/** Whitelist + normalize incoming filter JSON before it is stored. */
export function sanitizeFilters(input: unknown): ViewFilters {
	return normalizeFilters(input);
}

export interface BoardView {
	id: string;
	name: string;
	filters: ViewFilters;
	shared: boolean;
	/** True when the current user owns this view (can edit/delete it). */
	mine: boolean;
}

/** Views visible to a user on a board: their own plus any shared ones. */
export async function listViews(boardId: string, userId: string): Promise<BoardView[]> {
	const rows = await db
		.select({
			id: schema.boardViews.id,
			name: schema.boardViews.name,
			filters: schema.boardViews.filters,
			shared: schema.boardViews.shared,
			userId: schema.boardViews.userId
		})
		.from(schema.boardViews)
		.where(
			and(
				eq(schema.boardViews.boardId, boardId),
				or(eq(schema.boardViews.userId, userId), eq(schema.boardViews.shared, true))
			)
		)
		.orderBy(asc(schema.boardViews.name));
	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		filters: (r.filters as ViewFilters | null) ?? {},
		shared: r.shared,
		mine: r.userId === userId
	}));
}

export async function createView(
	boardId: string,
	userId: string,
	input: { name: string; filters: ViewFilters; shared: boolean }
): Promise<string> {
	const [row] = await db
		.insert(schema.boardViews)
		.values({
			boardId,
			userId,
			name: input.name,
			filters: input.filters as Record<string, unknown>,
			shared: input.shared
		})
		.returning({ id: schema.boardViews.id });
	return row.id;
}

/** Owner + board of a view, for authorization. */
export async function getView(
	id: string
): Promise<{ userId: string; boardId: string } | null> {
	const [row] = await db
		.select({ userId: schema.boardViews.userId, boardId: schema.boardViews.boardId })
		.from(schema.boardViews)
		.where(eq(schema.boardViews.id, id))
		.limit(1);
	return row ?? null;
}

export async function updateView(
	id: string,
	patch: { name?: string; filters?: ViewFilters; shared?: boolean }
): Promise<void> {
	await db
		.update(schema.boardViews)
		.set({
			...(patch.name !== undefined ? { name: patch.name } : {}),
			...(patch.filters !== undefined ? { filters: patch.filters as Record<string, unknown> } : {}),
			...(patch.shared !== undefined ? { shared: patch.shared } : {})
		})
		.where(eq(schema.boardViews.id, id));
}

export async function deleteView(id: string): Promise<void> {
	await db.delete(schema.boardViews).where(eq(schema.boardViews.id, id));
}
