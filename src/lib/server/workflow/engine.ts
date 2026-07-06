import { and, eq } from 'drizzle-orm';
import { CLOSED_CATEGORIES, type Priority } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import { boardEvent } from '$lib/server/realtime/board';
import { notifyWatchers, watch } from '$lib/server/services/notifications';
import { moveTicket, setAssignee, setLabel, updateTicket } from '$lib/server/services/tickets';

type Rule = typeof schema.workflowRules.$inferSelect;
type Ticket = typeof schema.tickets.$inferSelect;

export interface WorkflowEventCtx {
	/** For ticket.moved — the destination column name. */
	columnName?: string;
	/** For ticket.labeled — the added label id. */
	labelId?: string;
}

/** Does the rule's trigger config match this event's specifics? */
function triggerMatches(rule: Rule, ctx: WorkflowEventCtx): boolean {
	const cfg = (rule.trigger?.config ?? {}) as Record<string, unknown>;
	if (rule.trigger?.type === 'ticket.moved') {
		return !cfg.columnName || cfg.columnName === ctx.columnName;
	}
	if (rule.trigger?.type === 'ticket.labeled') {
		return !cfg.labelId || cfg.labelId === ctx.labelId;
	}
	return true;
}

/** Are all of the rule's conditions satisfied by the ticket? */
async function conditionsMatch(rule: Rule, ticket: Ticket): Promise<boolean> {
	const conds = rule.conditions ?? [];
	if (!conds.length) return true;
	let labelIds: Set<string> | null = null;
	for (const c of conds) {
		if (c.type === 'priority') {
			if (ticket.priority !== c.value) return false;
		} else if (c.type === 'has_label') {
			if (!labelIds) {
				const rows = await db
					.select({ labelId: schema.ticketLabels.labelId })
					.from(schema.ticketLabels)
					.where(eq(schema.ticketLabels.ticketId, ticket.id));
				labelIds = new Set(rows.map((r) => r.labelId));
			}
			if (!labelIds.has(c.value)) return false;
		}
	}
	return true;
}

/** Apply a rule's actions to a ticket via services (never re-enters the engine). */
async function applyActions(rule: Rule, ticket: Ticket): Promise<void> {
	for (const action of rule.actions ?? []) {
		const cfg = (action.config ?? {}) as Record<string, unknown>;
		try {
			switch (action.type) {
				case 'add_label':
					if (cfg.labelId) await setLabel(ticket.id, String(cfg.labelId), true);
					break;
				case 'assign':
					if (cfg.userId) {
						await setAssignee(ticket.id, String(cfg.userId), true);
						await watch('ticket', ticket.id, String(cfg.userId), 'assignee');
					}
					break;
				case 'set_priority':
					if (cfg.priority) await updateTicket(ticket.id, { priority: cfg.priority as Priority });
					break;
				case 'move_to_column':
					if (cfg.columnName && ticket.boardId) {
						const [target] = await db
							.select({ id: schema.boardColumns.id })
							.from(schema.boardColumns)
							.where(
								and(
									eq(schema.boardColumns.boardId, ticket.boardId),
									eq(schema.boardColumns.name, String(cfg.columnName))
								)
							)
							.limit(1);
						if (target) await moveTicket(ticket.id, target.id);
					}
					break;
				case 'post_comment':
					if (cfg.body) {
						await db.insert(schema.comments).values({
							subjectType: 'ticket',
							subjectId: ticket.id,
							authorId: null,
							body: String(cfg.body)
						});
					}
					break;
				case 'notify_watchers':
					await notifyWatchers({
						type: 'ticket.updated',
						subjectType: 'ticket',
						subjectId: ticket.id,
						actorId: null,
						body: `Automation: ${rule.name}`
					});
					break;
				case 'close':
					await closeTicket(ticket);
					break;
			}
		} catch (err) {
			console.warn(`[workflow] action ${action.type} failed on rule "${rule.name}":`, err);
		}
	}
	if (ticket.boardId) await boardEvent(ticket.boardId, 'ticket.updated', { ticketId: ticket.id });
}

/** Close = move to the board's first done/canceled column (sets closedAt). */
async function closeTicket(ticket: Ticket): Promise<void> {
	if (!ticket.boardId) return;
	const cols = await db
		.select({ id: schema.boardColumns.id, category: schema.boardColumns.category })
		.from(schema.boardColumns)
		.where(eq(schema.boardColumns.boardId, ticket.boardId));
	const closed = cols.find((c) => CLOSED_CATEGORIES.includes(c.category as never));
	if (closed) await moveTicket(ticket.id, closed.id);
}

/** Run a single (already-loaded) rule against one ticket. Used by the time sweep. */
export async function applyRuleToTicket(rule: Rule, ticketId: string): Promise<boolean> {
	const [ticket] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticketId)).limit(1);
	if (!ticket) return false;
	if (!(await conditionsMatch(rule, ticket))) return false;
	await applyActions(rule, ticket);
	return true;
}

/**
 * Evaluate all enabled rules on a project for a given trigger + ticket.
 * Returns the number of rules that fired. Best-effort — never throws.
 */
export async function evaluateEvent(
	projectId: string,
	triggerType: string,
	ticketId: string,
	ctx: WorkflowEventCtx = {}
): Promise<number> {
	try {
		const rules = await db
			.select()
			.from(schema.workflowRules)
			.where(and(eq(schema.workflowRules.projectId, projectId), eq(schema.workflowRules.enabled, true)));
		const matching = rules.filter((r) => r.trigger?.type === triggerType && triggerMatches(r, ctx));
		if (!matching.length) return 0;
		const [ticket] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticketId)).limit(1);
		if (!ticket) return 0;
		let fired = 0;
		for (const rule of matching) {
			if (!(await conditionsMatch(rule, ticket))) continue;
			await applyActions(rule, ticket);
			fired++;
		}
		return fired;
	} catch (err) {
		console.warn('[workflow] evaluateEvent failed:', err);
		return 0;
	}
}
