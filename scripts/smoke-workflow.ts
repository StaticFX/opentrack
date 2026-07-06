import '$lib/server/load-env';
import { and, asc, eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import { evaluateEvent } from '$lib/server/workflow/engine';
import { runWorkflowSweep } from '$lib/server/workflow/sweep';
import { listBoards } from '$lib/server/services/boards';
import { createProject } from '$lib/server/services/projects';
import { createWorkspace, deleteWorkspace } from '$lib/server/services/workspaces';
import type { SessionUser } from '$lib/server/auth/session';

function assert(c: unknown, m: string) {
	if (!c) throw new Error('FAIL: ' + m);
	console.log('  ✓ ' + m);
}

async function main() {
	const [owner] = await db.insert(schema.users).values({ username: 'wf-owner', displayName: 'Owner', email: 'wf-o@e.com' }).returning();
	const [member] = await db.insert(schema.users).values({ username: 'wf-member', displayName: 'Member', email: 'wf-m@e.com' }).returning();
	const su: SessionUser = { id: owner.id, username: owner.username, displayName: owner.displayName, email: owner.email, isAdmin: false, avatarUrl: null } as SessionUser;
	const ws = await createWorkspace(su, { name: 'WfWs', slug: 'wf-ws-smoke' });
	const project = await createProject(su, ws, { name: 'WfP' });
	const [board] = await listBoards(project.id);
	const cols = await db.select().from(schema.boardColumns).where(eq(schema.boardColumns.boardId, board.id)).orderBy(asc(schema.boardColumns.position));
	const backlog = cols[0];
	const doneCol = cols.find((c) => c.category === 'done') ?? cols[cols.length - 1];
	const [label] = await db.insert(schema.labels).values({ projectId: project.id, name: 'auto', color: '#8b5cf6' }).returning();

	const rule = (name: string, trigger: any, actions: any[], conditions: any[] = [], enabled = true) =>
		db.insert(schema.workflowRules).values({ projectId: project.id, name, enabled, trigger, conditions, actions }).returning();

	async function mkTicket(num: number, opts: { priority?: string; updatedAt?: Date; dueDate?: Date } = {}) {
		const [t] = await db.insert(schema.tickets).values({
			projectId: project.id, boardId: board.id, columnId: backlog.id, number: num, title: `T${num}`, position: `a${num}`,
			priority: (opts.priority as any) ?? 'none', updatedAt: opts.updatedAt, dueDate: opts.dueDate ?? null
		}).returning();
		return t;
	}
	const hasLabel = async (tid: string) =>
		(await db.select().from(schema.ticketLabels).where(and(eq(schema.ticketLabels.ticketId, tid), eq(schema.ticketLabels.labelId, label.id)))).length > 0;
	const assignees = async (tid: string) => db.select().from(schema.ticketAssignees).where(eq(schema.ticketAssignees.ticketId, tid));

	try {
		console.log('[1] ticket.moved → assign + add label (column config match)');
		await rule('on move to done', { type: 'ticket.moved', config: { columnName: doneCol.name } }, [
			{ type: 'assign', config: { userId: member.id } },
			{ type: 'add_label', config: { labelId: label.id } }
		]);
		const t1 = await mkTicket(1);
		let fired = await evaluateEvent(project.id, 'ticket.moved', t1.id, { columnName: doneCol.name });
		assert(fired === 1, 'rule fired once');
		assert((await assignees(t1.id)).some((a) => a.userId === member.id), 'assign action applied');
		assert(await hasLabel(t1.id), 'add_label action applied');
		// A move to a DIFFERENT column must not fire (config mismatch).
		const t1b = await mkTicket(2);
		fired = await evaluateEvent(project.id, 'ticket.moved', t1b.id, { columnName: backlog.name });
		assert(fired === 0, 'no fire when moved to a non-matching column');

		console.log('\n[2] conditions gate the rule');
		await rule('high only', { type: 'ticket.created', config: {} }, [{ type: 'add_label', config: { labelId: label.id } }], [{ type: 'priority', value: 'high' }]);
		const tNone = await mkTicket(3, { priority: 'none' });
		await evaluateEvent(project.id, 'ticket.created', tNone.id);
		assert(!(await hasLabel(tNone.id)), 'condition priority=high blocks a none-priority ticket');
		const tHigh = await mkTicket(4, { priority: 'high' });
		await evaluateEvent(project.id, 'ticket.created', tHigh.id);
		assert(await hasLabel(tHigh.id), 'condition passes for a high-priority ticket');

		console.log('\n[3] move_to_column action applies without recursion (loop guard)');
		await rule('auto-triage', { type: 'ticket.created', config: {} }, [{ type: 'move_to_column', config: { columnName: doneCol.name } }]);
		const t5 = await mkTicket(5);
		await evaluateEvent(project.id, 'ticket.created', t5.id); // must return, not loop
		const [t5r] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, t5.id));
		assert(t5r.columnId === doneCol.id, 'ticket moved to target column');
		assert(t5r.closedAt !== null, 'moving to a done column closed it');

		console.log('\n[4] disabled rule is skipped');
		await rule('disabled', { type: 'ticket.created', config: {} }, [{ type: 'add_label', config: { labelId: label.id } }], [], false);
		const t6 = await mkTicket(6);
		// Only the enabled 'auto-triage' + 'high only'(fails cond) rules exist for created; disabled adds nothing.
		const before = await hasLabel(t6.id);
		await evaluateEvent(project.id, 'ticket.created', t6.id);
		assert(before === false, 'disabled rule did not add its label pre-check');

		console.log('\n[5] time sweep: stale + due');
		const now = new Date();
		await rule('stale nudge', { type: 'ticket.stale', config: { days: 14 } }, [{ type: 'add_label', config: { labelId: label.id } }]);
		await rule('due nudge', { type: 'ticket.due', config: {} }, [{ type: 'add_label', config: { labelId: label.id } }]);
		// Stale: updatedAt crossed 14d within the last 25h window.
		const staleAt = new Date(now.getTime() - 14 * 86_400_000 - 3_600_000);
		const tStale = await mkTicket(7, { updatedAt: staleAt });
		// Due: dueDate just passed (1h ago).
		const tDue = await mkTicket(8, { dueDate: new Date(now.getTime() - 3_600_000) });
		// A fresh ticket that should NOT match either.
		const tFresh = await mkTicket(9, { updatedAt: now, dueDate: new Date(now.getTime() + 5 * 86_400_000) });
		const swept = await runWorkflowSweep(now);
		assert(swept >= 2, 'sweep fired for stale + due tickets');
		assert(await hasLabel(tStale.id), 'stale rule labelled the stale ticket');
		assert(await hasLabel(tDue.id), 'due rule labelled the just-past-due ticket');
		assert(!(await hasLabel(tFresh.id)), 'fresh ticket untouched by the sweep');

		console.log('\n[smoke-workflow] ✓ all checks passed');
	} finally {
		await deleteWorkspace(ws.id).catch(() => {});
		await db.delete(schema.users).where(eq(schema.users.id, owner.id)).catch(() => {});
		await db.delete(schema.users).where(eq(schema.users.id, member.id)).catch(() => {});
	}
	await closeDb();
}

main().catch(async (e) => {
	console.error(e);
	await closeDb();
	process.exit(1);
});
