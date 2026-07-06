import { and, inArray, eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { runStalenessSweep } from '$lib/server/services/staleness';
import { enqueue, registerHandler } from './queue';

const STALENESS_QUEUE = 'maintenance:staleness';
const DAY_MS = 86_400_000;

export function registerMaintenanceHandlers(): void {
	registerHandler(STALENESS_QUEUE, async () => {
		try {
			const n = await runStalenessSweep();
			if (n) console.log(`[maintenance] staleness sweep nudged ${n} ticket(s)`);
		} finally {
			// Reschedule the next daily sweep (self-perpetuating cron).
			await enqueue(STALENESS_QUEUE, {}, { runAt: new Date(Date.now() + DAY_MS) });
		}
	});
}

/**
 * Ensure exactly one staleness sweep is queued. Called on worker startup so the
 * daily cron survives restarts without piling up duplicates.
 */
export async function ensureScheduledJobs(): Promise<void> {
	try {
		const existing = await db
			.select({ id: schema.jobs.id })
			.from(schema.jobs)
			.where(and(eq(schema.jobs.queue, STALENESS_QUEUE), inArray(schema.jobs.status, ['pending', 'active'])))
			.limit(1);
		if (!existing.length) {
			await enqueue(STALENESS_QUEUE, {}, { runAt: new Date(Date.now() + DAY_MS) });
		}
	} catch (err) {
		console.warn('[maintenance] could not schedule staleness sweep:', err);
	}
}
