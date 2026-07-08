import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { getConfig } from '$lib/server/config';
import { enqueue, registerHandler } from '$lib/server/jobs/queue';
import { backupsSupported, createBackup, recordFailedBackup } from './service';

const BACKUP_QUEUE = 'backup:run';
const HOUR_MS = 3_600_000;

function nextRunAt(intervalHours: number): Date {
	return new Date(Date.now() + intervalHours * HOUR_MS);
}

export function registerBackupHandlers(): void {
	registerHandler(BACKUP_QUEUE, async () => {
		const cfg = (await getConfig()).backup;
		// Disabled (or wrong driver) → let the self-perpetuating chain stop.
		if (!cfg.auto || !backupsSupported()) return;
		try {
			await createBackup('auto');
		} catch (e) {
			await recordFailedBackup('auto', e instanceof Error ? e.message : String(e)).catch(() => {});
			console.warn('[backup] automatic backup failed:', e);
		} finally {
			const next = (await getConfig()).backup;
			if (next.auto) await enqueue(BACKUP_QUEUE, {}, { runAt: nextRunAt(next.intervalHours) });
		}
	});
}

/** Seed exactly one pending backup job when auto-backups are on (idempotent). */
export async function ensureBackupScheduled(): Promise<void> {
	try {
		const cfg = (await getConfig()).backup;
		if (!cfg.auto || !backupsSupported()) return;
		const existing = await db
			.select({ id: schema.jobs.id })
			.from(schema.jobs)
			.where(and(eq(schema.jobs.queue, BACKUP_QUEUE), inArray(schema.jobs.status, ['pending', 'active'])))
			.limit(1);
		if (!existing.length) await enqueue(BACKUP_QUEUE, {}, { runAt: nextRunAt(cfg.intervalHours) });
	} catch (e) {
		console.warn('[backup] could not schedule:', e);
	}
}

/** Drop the pending schedule and re-seed — so config changes take effect now. */
export async function rescheduleBackups(): Promise<void> {
	await db
		.delete(schema.jobs)
		.where(and(eq(schema.jobs.queue, BACKUP_QUEUE), eq(schema.jobs.status, 'pending')));
	await ensureBackupScheduled();
}
