import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { enqueue, registerHandler } from '$lib/server/jobs/queue';
import { evaluateEvent, type WorkflowEventCtx } from './engine';
import { runWorkflowSweep } from './sweep';

const SWEEP_QUEUE = 'workflow:sweep';
const DAY_MS = 86_400_000;

export function registerWorkflowHandlers(): void {
	// Event-driven: evaluate a project's rules for one ticket action.
	registerHandler('workflow:event', async (p) => {
		await evaluateEvent(
			String(p.projectId ?? ''),
			String(p.trigger ?? ''),
			String(p.ticketId ?? ''),
			(p.ctx as WorkflowEventCtx) ?? {}
		);
	});

	// Time-based: daily self-rescheduling sweep for stale / due rules.
	registerHandler(SWEEP_QUEUE, async () => {
		try {
			const n = await runWorkflowSweep();
			if (n) console.log(`[workflow] time-rule sweep fired ${n} rule(s)`);
		} finally {
			await enqueue(SWEEP_QUEUE, {}, { runAt: new Date(Date.now() + DAY_MS) });
		}
	});
}

/** Ensure exactly one workflow sweep is queued (idempotent on startup). */
export async function ensureWorkflowScheduled(): Promise<void> {
	try {
		const existing = await db
			.select({ id: schema.jobs.id })
			.from(schema.jobs)
			.where(and(eq(schema.jobs.queue, SWEEP_QUEUE), inArray(schema.jobs.status, ['pending', 'active'])))
			.limit(1);
		if (!existing.length) await enqueue(SWEEP_QUEUE, {}, { runAt: new Date(Date.now() + DAY_MS) });
	} catch (err) {
		console.warn('[workflow] could not schedule sweep:', err);
	}
}
