import { asc, eq, sql } from 'drizzle-orm';
import { rankAfter } from '$lib/rank';
import { db, schema } from '$lib/server/db';

export interface ChecklistItem {
	id: string;
	text: string;
	done: boolean;
}

export async function listChecklist(ticketId: string): Promise<ChecklistItem[]> {
	return db
		.select({ id: schema.checklistItems.id, text: schema.checklistItems.text, done: schema.checklistItems.done })
		.from(schema.checklistItems)
		.where(eq(schema.checklistItems.ticketId, ticketId))
		.orderBy(asc(schema.checklistItems.position), asc(schema.checklistItems.createdAt));
}

export async function addChecklistItem(ticketId: string, text: string): Promise<ChecklistItem> {
	// Place after the current last item.
	const [last] = await db
		.select({ position: schema.checklistItems.position })
		.from(schema.checklistItems)
		.where(eq(schema.checklistItems.ticketId, ticketId))
		.orderBy(sql`${schema.checklistItems.position} desc`)
		.limit(1);
	const position = rankAfter(last?.position ?? null);
	const [row] = await db
		.insert(schema.checklistItems)
		.values({ ticketId, text, position })
		.returning({ id: schema.checklistItems.id, text: schema.checklistItems.text, done: schema.checklistItems.done });
	return row;
}

export async function updateChecklistItem(
	id: string,
	patch: { text?: string; done?: boolean }
): Promise<void> {
	await db
		.update(schema.checklistItems)
		.set({
			...(patch.text !== undefined ? { text: patch.text } : {}),
			...(patch.done !== undefined ? { done: patch.done } : {})
		})
		.where(eq(schema.checklistItems.id, id));
}

export async function deleteChecklistItem(id: string): Promise<void> {
	await db.delete(schema.checklistItems).where(eq(schema.checklistItems.id, id));
}

/** The ticket a checklist item belongs to (for access checks). */
export async function checklistItemTicket(id: string): Promise<string | null> {
	const [row] = await db
		.select({ ticketId: schema.checklistItems.ticketId })
		.from(schema.checklistItems)
		.where(eq(schema.checklistItems.id, id))
		.limit(1);
	return row?.ticketId ?? null;
}
