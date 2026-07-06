import { and, eq, gt, isNull, lte } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { listWatchers, notifyUsers } from './notifications';

/** Days of inactivity before an open ticket is considered stale. */
export function staleDays(): number {
	const n = Number(process.env.OT_STALE_DAYS);
	return Number.isFinite(n) && n > 0 ? n : 14;
}

export interface StaleTicket {
	id: string;
	number: number;
	title: string;
	projectId: string;
}

/**
 * Open tickets that crossed the staleness threshold within the last
 * `windowHours` — i.e. they just became stale. The window (slightly wider than
 * the daily sweep interval) means each ticket is surfaced exactly once as it
 * ages past the line, without a persisted "notified" marker.
 */
export async function findNewlyStale(
	now: Date,
	days = staleDays(),
	windowHours = 25
): Promise<StaleTicket[]> {
	const threshold = new Date(now.getTime() - days * 86_400_000);
	const lower = new Date(threshold.getTime() - windowHours * 3_600_000);
	return db
		.select({
			id: schema.tickets.id,
			number: schema.tickets.number,
			title: schema.tickets.title,
			projectId: schema.tickets.projectId
		})
		.from(schema.tickets)
		.where(
			and(
				isNull(schema.tickets.closedAt),
				lte(schema.tickets.updatedAt, threshold),
				gt(schema.tickets.updatedAt, lower)
			)
		);
}

/** Notify the assignees + watchers of each newly-stale ticket. Returns count nudged. */
export async function runStalenessSweep(now = new Date()): Promise<number> {
	const days = staleDays();
	const stale = await findNewlyStale(now, days);
	let nudged = 0;
	for (const t of stale) {
		const [assignees, watchers] = await Promise.all([
			db
				.select({ userId: schema.ticketAssignees.userId })
				.from(schema.ticketAssignees)
				.where(eq(schema.ticketAssignees.ticketId, t.id)),
			listWatchers('ticket', t.id)
		]);
		const recipients = [...new Set([...assignees.map((a) => a.userId), ...watchers])];
		if (!recipients.length) continue;
		await notifyUsers(recipients, {
			type: 'ticket.stale',
			subjectType: 'ticket',
			subjectId: t.id,
			body: `No activity in ${days} days — needs attention`
		});
		nudged++;
	}
	return nudged;
}
