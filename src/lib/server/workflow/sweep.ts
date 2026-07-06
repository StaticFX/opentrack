import { and, eq, gte, isNull, lt } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { applyRuleToTicket } from './engine';

const DAY_MS = 86_400_000;
// Fire-once window: a ticket that just crossed the threshold since the last
// daily sweep (mirrors the staleness sweep). Applying actions bumps updatedAt,
// so stale rules also won't re-fire.
const WINDOW_MS = 25 * 60 * 60 * 1000;

/**
 * Evaluate time-based rules (ticket.stale / ticket.due). Only tickets that
 * *crossed* the threshold within the last sweep window fire, so a rule acts once.
 * Returns the number of (rule, ticket) applications.
 */
export async function runWorkflowSweep(now = new Date()): Promise<number> {
	const rules = await db.select().from(schema.workflowRules).where(eq(schema.workflowRules.enabled, true));
	const timeRules = rules.filter((r) => r.trigger?.type === 'ticket.stale' || r.trigger?.type === 'ticket.due');
	let fired = 0;

	for (const rule of timeRules) {
		const cfg = (rule.trigger?.config ?? {}) as Record<string, unknown>;
		let tickets: Array<{ id: string }> = [];

		if (rule.trigger?.type === 'ticket.stale') {
			const days = Number(cfg.days) > 0 ? Number(cfg.days) : 14;
			const hi = new Date(now.getTime() - days * DAY_MS); // crossed the threshold at/older than this
			const lo = new Date(hi.getTime() - WINDOW_MS); // ...within the last window
			tickets = await db
				.select({ id: schema.tickets.id })
				.from(schema.tickets)
				.where(
					and(
						eq(schema.tickets.projectId, rule.projectId),
						isNull(schema.tickets.closedAt),
						gte(schema.tickets.updatedAt, lo),
						lt(schema.tickets.updatedAt, hi)
					)
				);
		} else {
			// ticket.due — due date just passed within the window.
			const lo = new Date(now.getTime() - WINDOW_MS);
			tickets = await db
				.select({ id: schema.tickets.id })
				.from(schema.tickets)
				.where(
					and(
						eq(schema.tickets.projectId, rule.projectId),
						isNull(schema.tickets.closedAt),
						gte(schema.tickets.dueDate, lo),
						lt(schema.tickets.dueDate, now)
					)
				);
		}

		for (const t of tickets) {
			if (await applyRuleToTicket(rule, t.id)) fired++;
		}
	}
	return fired;
}
