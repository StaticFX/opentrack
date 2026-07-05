import { and, asc, eq, lte } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';

export type JobRow = typeof schema.jobs.$inferSelect;
export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

const handlers = new Map<string, JobHandler>();

/** Register a handler for a named queue. */
export function registerHandler(queue: string, handler: JobHandler): void {
	handlers.set(queue, handler);
}

export interface EnqueueOptions {
	runAt?: Date;
	maxAttempts?: number;
}

/** Enqueue a job. Portable across Postgres & SQLite (plain table insert). */
export async function enqueue(
	queue: string,
	payload: Record<string, unknown>,
	opts: EnqueueOptions = {}
): Promise<void> {
	await db.insert(schema.jobs).values({
		queue,
		payload,
		status: 'pending',
		runAt: opts.runAt ?? new Date(),
		maxAttempts: opts.maxAttempts ?? 5
	});
}

/**
 * Claim the next runnable job with a portable select-then-conditional-update
 * (no `FOR UPDATE SKIP LOCKED`, so it works on SQLite too). If the guarded
 * update touches 0 rows another worker won the race — the caller retries.
 */
async function claimNext(workerId: string): Promise<JobRow | null> {
	const now = new Date();
	const [candidate] = await db
		.select()
		.from(schema.jobs)
		.where(and(eq(schema.jobs.status, 'pending'), lte(schema.jobs.runAt, now)))
		.orderBy(asc(schema.jobs.runAt))
		.limit(1);
	if (!candidate) return null;

	const claimed = await db
		.update(schema.jobs)
		.set({ status: 'active', lockedAt: now, lockedBy: workerId, updatedAt: now })
		.where(and(eq(schema.jobs.id, candidate.id), eq(schema.jobs.status, 'pending')))
		.returning({ id: schema.jobs.id });

	return claimed.length > 0 ? candidate : null;
}

async function runJob(job: JobRow): Promise<void> {
	const handler = handlers.get(job.queue);
	const now = new Date();

	if (!handler) {
		await db
			.update(schema.jobs)
			.set({ status: 'failed', lastError: `no handler for queue "${job.queue}"`, updatedAt: now })
			.where(eq(schema.jobs.id, job.id));
		return;
	}

	try {
		await handler((job.payload ?? {}) as Record<string, unknown>);
		await db
			.update(schema.jobs)
			.set({ status: 'completed', updatedAt: new Date() })
			.where(eq(schema.jobs.id, job.id));
	} catch (err) {
		const attempts = job.attempts + 1;
		const message = err instanceof Error ? err.message : String(err);
		if (attempts >= job.maxAttempts) {
			await db
				.update(schema.jobs)
				.set({ status: 'failed', attempts, lastError: message, updatedAt: new Date() })
				.where(eq(schema.jobs.id, job.id));
		} else {
			// Exponential backoff, capped at 5 minutes.
			const delayMs = Math.min(2 ** attempts * 1000, 300_000);
			await db
				.update(schema.jobs)
				.set({
					status: 'pending',
					attempts,
					lastError: message,
					lockedAt: null,
					lockedBy: null,
					runAt: new Date(Date.now() + delayMs),
					updatedAt: new Date()
				})
				.where(eq(schema.jobs.id, job.id));
		}
	}
}

/** Drain all currently-runnable jobs. Returns the number processed. */
export async function drain(workerId: string): Promise<number> {
	let processed = 0;
	for (;;) {
		const job = await claimNext(workerId);
		if (!job) break;
		await runJob(job);
		processed++;
	}
	return processed;
}

export interface WorkerHandle {
	stop: () => void;
}

/** Start a polling worker loop. Safe to run in-process or as a standalone entry. */
export function startWorker(opts: { workerId?: string; intervalMs?: number } = {}): WorkerHandle {
	const workerId = opts.workerId ?? `worker-${process.pid}`;
	const intervalMs = opts.intervalMs ?? 2000;
	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const tick = async () => {
		if (stopped) return;
		try {
			await drain(workerId);
		} catch (err) {
			console.error('[jobs] worker tick failed:', err);
		}
		if (!stopped) timer = setTimeout(tick, intervalMs);
	};

	void tick();

	return {
		stop: () => {
			stopped = true;
			if (timer) clearTimeout(timer);
		}
	};
}
