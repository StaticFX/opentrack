import '$lib/server/load-env';
import { and, eq, inArray } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { ensureScheduledJobs } from '$lib/server/jobs';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { listNotifications, watch } from '$lib/server/services/notifications';
import { createProject } from '$lib/server/services/projects';
import { createTicket, setAssignee } from '$lib/server/services/tickets';
import { findNewlyStale, runStalenessSweep } from '$lib/server/services/staleness';
import { createWorkspace } from '$lib/server/services/workspaces';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}
async function mkUser(name: string): Promise<SessionUser> {
	const [u] = await db.insert(schema.users).values({ username: `${name}-${Date.now()}-${Math.floor(performance.now())}`, displayName: name }).returning();
	return { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };
}
const DAY = 86_400_000, HOUR = 3_600_000;

async function main() {
	const owner = await mkUser('owner');
	const watcher = await mkUser('watcher');
	const ws = await createWorkspace(owner, { name: 'Stale WS' });
	const project = await createProject(owner, { ...ws }, { name: 'Stale Proj' });
	const [board] = await listBoards(project.id);
	const todo = (await getBoardColumns(board.id)).find((c) => c.category === 'todo')!;

	const now = new Date('2026-06-01T00:00:00Z');
	const threshold = now.getTime() - 14 * DAY;
	const mk = async (title: string, updatedAt: Date, closed = false) => {
		const t = await createTicket(owner, { projectId: project.id, boardId: board.id, columnId: todo.id, title });
		await db.update(schema.tickets).set({ updatedAt, closedAt: closed ? updatedAt : null }).where(eq(schema.tickets.id, t.id));
		return t;
	};

	const justStale = await mk('Just crossed the line', new Date(threshold - HOUR));   // in window
	const tooOld = await mk('Ancient', new Date(threshold - 30 * HOUR));               // below window
	const recent = await mk('Fresh', new Date(now.getTime() - 2 * DAY));               // above threshold
	const closedStale = await mk('Closed but old', new Date(threshold - HOUR), true);  // excluded (closed)
	const noWatchers = await mk('Nobody follows me', new Date(threshold - HOUR));      // stale but no recipients

	// Recipients for the just-stale ticket.
	await setAssignee(justStale.id, owner.id, true);
	await watch('ticket', justStale.id, watcher.id, 'manual');

	console.log('[1] window selects only newly-stale, open tickets');
	const stale = await findNewlyStale(now);
	const ids = stale.map((t) => t.id);
	assert(ids.includes(justStale.id), 'ticket that just crossed threshold is stale');
	assert(!ids.includes(tooOld.id), 'ticket older than the window is not re-flagged');
	assert(!ids.includes(recent.id), 'recently-updated ticket is not stale');
	assert(!ids.includes(closedStale.id), 'closed ticket excluded');
	assert(ids.includes(noWatchers.id), 'stale ticket with no followers still detected');

	console.log('[2] sweep notifies assignees + watchers, skips followerless');
	const nudged = await runStalenessSweep(now);
	assert(nudged === 1, `exactly one ticket nudged (got ${nudged})`);
	const ownerNotifs = await listNotifications(owner.id, {});
	const watcherNotifs = await listNotifications(watcher.id, {});
	assert(ownerNotifs.some((n) => n.type === 'ticket.stale'), 'assignee got a stale nudge');
	assert(watcherNotifs.some((n) => n.type === 'ticket.stale'), 'watcher got a stale nudge');

	console.log('[3] ensureScheduledJobs is idempotent');
	await db.delete(schema.jobs).where(eq(schema.jobs.queue, 'maintenance:staleness'));
	await ensureScheduledJobs();
	await ensureScheduledJobs();
	const jobs = await db.select().from(schema.jobs).where(and(eq(schema.jobs.queue, 'maintenance:staleness'), inArray(schema.jobs.status, ['pending', 'active'])));
	assert(jobs.length === 1, 'only one staleness sweep scheduled after two calls');

	await db.delete(schema.jobs).where(eq(schema.jobs.queue, 'maintenance:staleness'));
	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	for (const u of [owner, watcher]) await db.delete(schema.users).where(eq(schema.users.id, u.id));

	console.log('\n✅ smoke-staleness passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-staleness failed:', err);
	await closeDb();
	process.exit(1);
});
