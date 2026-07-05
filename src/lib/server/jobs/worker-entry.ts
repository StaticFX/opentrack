// Standalone worker process: `npm run worker`. Runs the job loop independently
// of the web server (useful when scaling the app horizontally).
import { closeDb } from '$lib/server/db';
import { registerAllHandlers, startWorker } from './index';

registerAllHandlers();
const worker = startWorker({ workerId: `standalone-${process.pid}` });
console.log('[jobs] standalone worker started');

async function shutdown() {
	console.log('[jobs] shutting down…');
	worker.stop();
	await closeDb();
	process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
