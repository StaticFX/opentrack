import { asc, desc, eq } from 'drizzle-orm';
import type { ColumnCategory } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import { rankAfter } from '$lib/server/util/rank';

export type Column = typeof schema.boardColumns.$inferSelect;

export async function createColumn(
	boardId: string,
	input: { name: string; color?: string; icon?: string; category?: ColumnCategory }
): Promise<Column> {
	const [last] = await db
		.select({ position: schema.boardColumns.position })
		.from(schema.boardColumns)
		.where(eq(schema.boardColumns.boardId, boardId))
		.orderBy(desc(schema.boardColumns.position))
		.limit(1);

	const [col] = await db
		.insert(schema.boardColumns)
		.values({
			boardId,
			name: input.name,
			color: input.color ?? '#6b7280',
			icon: input.icon ?? null,
			category: input.category ?? 'todo',
			position: rankAfter(last?.position ?? null)
		})
		.returning();
	return col;
}

export interface UpdateColumnInput {
	name?: string;
	color?: string;
	icon?: string | null;
	category?: ColumnCategory;
	wipLimit?: number | null;
	position?: string;
}

export async function updateColumn(id: string, patch: UpdateColumnInput): Promise<void> {
	await db
		.update(schema.boardColumns)
		.set({
			...(patch.name !== undefined ? { name: patch.name } : {}),
			...(patch.color !== undefined ? { color: patch.color } : {}),
			...(patch.icon !== undefined ? { icon: patch.icon } : {}),
			...(patch.category !== undefined ? { category: patch.category } : {}),
			...(patch.wipLimit !== undefined ? { wipLimit: patch.wipLimit } : {}),
			...(patch.position !== undefined ? { position: patch.position } : {})
		})
		.where(eq(schema.boardColumns.id, id));
}

/**
 * Delete a column, moving its tickets to another column first. Returns false if
 * it's the last column (a board must keep at least one).
 */
export async function deleteColumn(boardId: string, id: string): Promise<boolean> {
	const cols = await db
		.select({ id: schema.boardColumns.id })
		.from(schema.boardColumns)
		.where(eq(schema.boardColumns.boardId, boardId))
		.orderBy(asc(schema.boardColumns.position));
	if (cols.length <= 1) return false;

	const fallback = cols.find((c) => c.id !== id);
	if (!fallback) return false;

	await db.transaction(async (tx) => {
		await tx
			.update(schema.tickets)
			.set({ columnId: fallback.id })
			.where(eq(schema.tickets.columnId, id));
		await tx.delete(schema.boardColumns).where(eq(schema.boardColumns.id, id));
	});
	return true;
}
