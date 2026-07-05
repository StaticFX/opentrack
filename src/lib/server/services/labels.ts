import { asc, eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';

export type Label = typeof schema.labels.$inferSelect;

export function listLabels(projectId: string): Promise<Label[]> {
	return db
		.select()
		.from(schema.labels)
		.where(eq(schema.labels.projectId, projectId))
		.orderBy(asc(schema.labels.name));
}

export async function createLabel(
	projectId: string,
	input: { name: string; color: string; description?: string }
): Promise<Label> {
	const [label] = await db
		.insert(schema.labels)
		.values({
			projectId,
			name: input.name,
			color: input.color,
			description: input.description ?? null
		})
		.returning();
	return label;
}

export async function updateLabel(
	id: string,
	patch: { name?: string; color?: string; description?: string | null }
): Promise<void> {
	await db
		.update(schema.labels)
		.set({
			...(patch.name !== undefined ? { name: patch.name } : {}),
			...(patch.color !== undefined ? { color: patch.color } : {}),
			...(patch.description !== undefined ? { description: patch.description } : {})
		})
		.where(eq(schema.labels.id, id));
}

export async function deleteLabel(id: string): Promise<void> {
	await db.delete(schema.labels).where(eq(schema.labels.id, id));
}
