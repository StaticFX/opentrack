import { ensureBackupScheduled, registerBackupHandlers } from '$lib/server/backup/jobs';
import { registerDiscordHandlers } from '$lib/server/discord/jobs';
import { registerGithubHandlers } from '$lib/server/github/jobs';
import { registerIntegrationHandlers } from '$lib/server/integrations/jobs';
import { ensureWorkflowScheduled, registerWorkflowHandlers } from '$lib/server/workflow/jobs';
import { ensureScheduledJobs as ensureMaintenanceScheduled, registerMaintenanceHandlers } from './maintenance';
import { registerNotifyHandlers } from './notify';
import { registerHandler } from './queue';

export * from './queue';

/** Ensure all recurring/cron jobs are queued (idempotent, called on startup). */
export async function ensureScheduledJobs(): Promise<void> {
	await ensureMaintenanceScheduled();
	await ensureWorkflowScheduled();
	await ensureBackupScheduled();
}

/**
 * Register all job handlers. Called once from the worker entry and from the
 * app's in-process worker bootstrap.
 */
export function registerAllHandlers(): void {
	registerHandler('noop', async () => {
		/* intentionally does nothing */
	});
	registerGithubHandlers();
	registerNotifyHandlers();
	registerDiscordHandlers();
	registerIntegrationHandlers();
	registerMaintenanceHandlers();
	registerWorkflowHandlers();
	registerBackupHandlers();
}
