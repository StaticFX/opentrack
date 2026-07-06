import { bootstrapAdmin } from '$lib/server/auth/bootstrap';
import { ensureScheduledJobs, registerAllHandlers, startWorker } from '$lib/server/jobs';

// One-time process initialization, guarded against dev HMR re-runs.
const g = globalThis as unknown as { __otStarted?: boolean };

export function ensureStarted(): void {
	if (g.__otStarted) return;
	g.__otStarted = true;

	registerAllHandlers();

	// Fire-and-forget: create the bootstrap admin if configured.
	void bootstrapAdmin().catch((err) => console.error('[bootstrap] admin creation failed:', err));

	// Run the job worker in-process by default. Set OT_DISABLE_INPROCESS_WORKER=1
	// when running a dedicated `npm run worker` process alongside the web server.
	if (process.env.OT_DISABLE_INPROCESS_WORKER !== '1') {
		startWorker({ workerId: `app-${process.pid}` });
		void ensureScheduledJobs();
	}
}
