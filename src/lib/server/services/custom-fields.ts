import { and, asc, eq, sql } from 'drizzle-orm';
import type { CustomFieldDef, CustomFieldType, CustomFieldValue } from '$lib/customFields';
import { rankAfter } from '$lib/rank';
import { db, schema } from '$lib/server/db';

export async function listFields(projectId: string): Promise<CustomFieldDef[]> {
	const rows = await db
		.select({
			id: schema.customFields.id,
			name: schema.customFields.name,
			type: schema.customFields.type,
			options: schema.customFields.options
		})
		.from(schema.customFields)
		.where(eq(schema.customFields.projectId, projectId))
		.orderBy(asc(schema.customFields.position), asc(schema.customFields.createdAt));
	return rows.map((r) => ({ id: r.id, name: r.name, type: r.type as CustomFieldType, options: (r.options as string[] | null) ?? null }));
}

export async function createField(
	projectId: string,
	input: { name: string; type: CustomFieldType; options?: string[] | null }
): Promise<string> {
	const [last] = await db
		.select({ position: schema.customFields.position })
		.from(schema.customFields)
		.where(eq(schema.customFields.projectId, projectId))
		.orderBy(sql`${schema.customFields.position} desc`)
		.limit(1);
	const [row] = await db
		.insert(schema.customFields)
		.values({
			projectId,
			name: input.name,
			type: input.type,
			options: input.type === 'select' ? (input.options ?? []) : null,
			position: rankAfter(last?.position ?? null)
		})
		.returning({ id: schema.customFields.id });
	return row.id;
}

export async function updateField(
	id: string,
	patch: { name?: string; options?: string[] | null }
): Promise<void> {
	await db
		.update(schema.customFields)
		.set({
			...(patch.name !== undefined ? { name: patch.name } : {}),
			...(patch.options !== undefined ? { options: patch.options } : {})
		})
		.where(eq(schema.customFields.id, id));
}

export async function deleteField(id: string): Promise<void> {
	await db.delete(schema.customFields).where(eq(schema.customFields.id, id));
}

/** The project a field belongs to (for authz). */
export async function fieldProject(id: string): Promise<string | null> {
	const [row] = await db
		.select({ projectId: schema.customFields.projectId })
		.from(schema.customFields)
		.where(eq(schema.customFields.id, id))
		.limit(1);
	return row?.projectId ?? null;
}

/** A ticket's custom fields: every project field, merged with any set value. */
export async function getTicketFields(
	ticketId: string,
	projectId: string
): Promise<CustomFieldValue[]> {
	const [fields, values] = await Promise.all([
		listFields(projectId),
		db
			.select({ fieldId: schema.ticketFieldValues.fieldId, value: schema.ticketFieldValues.value })
			.from(schema.ticketFieldValues)
			.where(eq(schema.ticketFieldValues.ticketId, ticketId))
	]);
	const byField = new Map(values.map((v) => [v.fieldId, v.value]));
	return fields.map((f) => ({ ...f, value: byField.get(f.id) ?? null }));
}

/** Upsert (or clear, when value is empty) a ticket's value for one field. */
export async function setTicketFieldValue(
	ticketId: string,
	fieldId: string,
	value: string | null
): Promise<void> {
	if (value == null || value === '') {
		await db
			.delete(schema.ticketFieldValues)
			.where(and(eq(schema.ticketFieldValues.ticketId, ticketId), eq(schema.ticketFieldValues.fieldId, fieldId)));
		return;
	}
	await db
		.insert(schema.ticketFieldValues)
		.values({ ticketId, fieldId, value })
		.onConflictDoUpdate({
			target: [schema.ticketFieldValues.ticketId, schema.ticketFieldValues.fieldId],
			set: { value }
		});
}
