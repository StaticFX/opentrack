import { and, asc, count, eq, isNotNull, isNull } from 'drizzle-orm';
import type { MilestoneState } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import { rankAfter } from '$lib/server/util/rank';

export type Milestone = typeof schema.milestones.$inferSelect;

export interface MilestoneWithCounts extends Milestone {
	openCount: number;
	closedCount: number;
}

/** All milestones for a project, with open/closed ticket counts. */
export async function listMilestones(projectId: string): Promise<MilestoneWithCounts[]> {
	const rows = await db
		.select()
		.from(schema.milestones)
		.where(eq(schema.milestones.projectId, projectId))
		.orderBy(asc(schema.milestones.position), asc(schema.milestones.createdAt));
	if (rows.length === 0) return [];

	const [openRows, closedRows] = await Promise.all([
		db
			.select({ milestoneId: schema.tickets.milestoneId, c: count() })
			.from(schema.tickets)
			.where(and(eq(schema.tickets.projectId, projectId), isNotNull(schema.tickets.milestoneId), isNull(schema.tickets.closedAt)))
			.groupBy(schema.tickets.milestoneId),
		db
			.select({ milestoneId: schema.tickets.milestoneId, c: count() })
			.from(schema.tickets)
			.where(and(eq(schema.tickets.projectId, projectId), isNotNull(schema.tickets.milestoneId), isNotNull(schema.tickets.closedAt)))
			.groupBy(schema.tickets.milestoneId)
	]);
	const open = new Map(openRows.map((r) => [r.milestoneId, Number(r.c)]));
	const closed = new Map(closedRows.map((r) => [r.milestoneId, Number(r.c)]));

	return rows.map((m) => ({
		...m,
		openCount: open.get(m.id) ?? 0,
		closedCount: closed.get(m.id) ?? 0
	}));
}

export async function getMilestone(id: string): Promise<Milestone | null> {
	const [m] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, id)).limit(1);
	return m ?? null;
}

export interface MilestoneInput {
	title: string;
	description?: string | null;
	dueDate?: Date | null;
	state?: MilestoneState;
}

export async function createMilestone(projectId: string, input: MilestoneInput): Promise<Milestone> {
	const [last] = await db
		.select({ position: schema.milestones.position })
		.from(schema.milestones)
		.where(eq(schema.milestones.projectId, projectId))
		.orderBy(asc(schema.milestones.position))
		.limit(1);
	const [m] = await db
		.insert(schema.milestones)
		.values({
			projectId,
			title: input.title,
			description: input.description ?? null,
			dueDate: input.dueDate ?? null,
			state: input.state ?? 'open',
			position: rankAfter(last?.position ?? null)
		})
		.returning();
	return m;
}

export async function updateMilestone(
	id: string,
	patch: { title?: string; description?: string | null; dueDate?: Date | null; state?: MilestoneState }
): Promise<void> {
	await db
		.update(schema.milestones)
		.set({
			...(patch.title !== undefined ? { title: patch.title } : {}),
			...(patch.description !== undefined ? { description: patch.description } : {}),
			...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
			...(patch.state !== undefined ? { state: patch.state } : {}),
			updatedAt: new Date()
		})
		.where(eq(schema.milestones.id, id));
}

export async function deleteMilestone(id: string): Promise<void> {
	// tickets.milestoneId is ON DELETE SET NULL, so tickets simply detach.
	await db.delete(schema.milestones).where(eq(schema.milestones.id, id));
}

/** Assign (or clear, with null) a ticket's milestone. */
export async function setTicketMilestone(ticketId: string, milestoneId: string | null): Promise<void> {
	await db
		.update(schema.tickets)
		.set({ milestoneId, updatedAt: new Date() })
		.where(eq(schema.tickets.id, ticketId));
}
