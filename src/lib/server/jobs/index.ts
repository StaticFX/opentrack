import { registerGithubHandlers } from '$lib/server/github/jobs';
import { registerHandler } from './queue';

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
}
