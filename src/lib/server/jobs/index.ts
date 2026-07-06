import { registerDiscordHandlers } from '$lib/server/discord/jobs';
import { registerGithubHandlers } from '$lib/server/github/jobs';
import { registerMaintenanceHandlers } from './maintenance';
import { registerNotifyHandlers } from './notify';
import { registerHandler } from './queue';

export { ensureScheduledJobs } from './maintenance';

export * from './queue';

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
	registerMaintenanceHandlers();
}
