import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';

export interface WeeklyPoint {
	label: string;
	opened: number;
	closed: number;
}
export interface ProjectAnalytics {
	totals: { open: number; closed: number; total: number };
	/** Average days from creation to close over closed tickets, or null. */
	cycleTimeDays: number | null;
	weekly: WeeklyPoint[];
	byPriority: Array<{ priority: string; count: number }>;
	byLabel: Array<{ name: string; color: string; count: number }>;
}

const DAY = 86_400_000;
const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low', 'none'];

/**
 * Project metrics computed in JS from raw timestamps so the queries stay portable
 * across Postgres & SQLite (no dialect-specific date bucketing in SQL).
 */
export async function getProjectAnalytics(
	projectId: string,
	now = new Date(),
	weeks = 8
): Promise<ProjectAnalytics> {
	const rows = await db
		.select({
			createdAt: schema.tickets.createdAt,
			closedAt: schema.tickets.closedAt,
			priority: schema.tickets.priority
		})
		.from(schema.tickets)
		.where(eq(schema.tickets.projectId, projectId));

	const total = rows.length;
	const closedRows = rows.filter((r) => r.closedAt != null);
	const closed = closedRows.length;

	const cycleTimeDays = closed
		? closedRows.reduce((sum, r) => sum + (new Date(r.closedAt!).getTime() - new Date(r.createdAt).getTime()), 0) /
			closed /
			DAY
		: null;

	// Weekly bins ending at `now`, oldest first.
	const end = now.getTime();
	const bins: WeeklyPoint[] = [];
	for (let i = weeks - 1; i >= 0; i--) {
		const start = end - (i + 1) * 7 * DAY;
		const stop = end - i * 7 * DAY;
		let opened = 0;
		let closedCount = 0;
		for (const r of rows) {
			const c = new Date(r.createdAt).getTime();
			if (c > start && c <= stop) opened++;
			if (r.closedAt) {
				const cl = new Date(r.closedAt).getTime();
				if (cl > start && cl <= stop) closedCount++;
			}
		}
		const d = new Date(stop);
		bins.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, opened, closed: closedCount });
	}

	const priCount = new Map<string, number>();
	for (const r of rows) priCount.set(r.priority, (priCount.get(r.priority) ?? 0) + 1);
	const byPriority = PRIORITY_ORDER.filter((p) => priCount.has(p)).map((p) => ({ priority: p, count: priCount.get(p)! }));

	const labelRows = await db
		.select({ name: schema.labels.name, color: schema.labels.color })
		.from(schema.ticketLabels)
		.innerJoin(schema.labels, eq(schema.ticketLabels.labelId, schema.labels.id))
		.innerJoin(schema.tickets, eq(schema.ticketLabels.ticketId, schema.tickets.id))
		.where(eq(schema.tickets.projectId, projectId));
	const labelAgg = new Map<string, { color: string; count: number }>();
	for (const r of labelRows) {
		const cur = labelAgg.get(r.name) ?? { color: r.color, count: 0 };
		cur.count++;
		labelAgg.set(r.name, cur);
	}
	const byLabel = [...labelAgg.entries()]
		.map(([name, v]) => ({ name, color: v.color, count: v.count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 8);

	return { totals: { open: total - closed, closed, total }, cycleTimeDays, weekly: bins, byPriority, byLabel };
}
