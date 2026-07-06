import '$lib/server/load-env';
import { eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { getProjectAnalytics } from '$lib/server/services/analytics';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { createLabel } from '$lib/server/services/labels';
import { createProject } from '$lib/server/services/projects';
import { createTicket, setLabel } from '$lib/server/services/tickets';
import { createWorkspace } from '$lib/server/services/workspaces';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}
const DAY = 86_400_000;

async function main() {
	const [u] = await db.insert(schema.users).values({ username: `an-${Date.now()}`, displayName: 'An' }).returning();
	const user: SessionUser = { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };
	const ws = await createWorkspace(user, { name: 'An WS' });
	const project = await createProject(user, { ...ws }, { name: 'An Proj' });
	const [board] = await listBoards(project.id);
	const todo = (await getBoardColumns(board.id)).find((c) => c.category === 'todo')!;
	const bug = await createLabel(project.id, { name: 'bug', color: '#ef4444' });

	const now = new Date('2026-06-01T00:00:00Z');
	const mk = async (title: string, createdAt: Date, closedAt: Date | null, priority: string) => {
		const t = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: todo.id, title, priority: priority as never });
		await db.update(schema.tickets).set({ createdAt, closedAt }).where(eq(schema.tickets.id, t.id));
		return t;
	};
	const a = await mk('A', new Date(now.getTime() - 3 * DAY), new Date(now.getTime() - 1 * DAY), 'high');
	const b = await mk('B', new Date(now.getTime() - 10 * DAY), new Date(now.getTime() - 8 * DAY), 'low');
	await mk('C', new Date(now.getTime() - 2 * DAY), null, 'high');
	await setLabel(a.id, bug.id, true);
	await setLabel(b.id, bug.id, true);

	const an = await getProjectAnalytics(project.id, now, 8);

	console.log('[1] totals');
	assert(an.totals.total === 3 && an.totals.closed === 2 && an.totals.open === 1, 'total 3 / closed 2 / open 1');

	console.log('[2] cycle time = avg(close - create) in days');
	assert(an.cycleTimeDays != null && Math.abs(an.cycleTimeDays - 2) < 0.01, `avg cycle time 2.0d (got ${an.cycleTimeDays})`);

	console.log('[3] weekly bins bucket by created/closed');
	const last = an.weekly[an.weekly.length - 1];
	const prev = an.weekly[an.weekly.length - 2];
	assert(last.opened === 2 && last.closed === 1, `most recent week: opened 2 / closed 1 (got ${last.opened}/${last.closed})`);
	assert(prev.opened === 1 && prev.closed === 1, `prior week: opened 1 / closed 1 (got ${prev.opened}/${prev.closed})`);
	assert(an.weekly.length === 8, '8 weekly bins');

	console.log('[4] priority + label distributions');
	const pri = Object.fromEntries(an.byPriority.map((p) => [p.priority, p.count]));
	assert(pri.high === 2 && pri.low === 1, 'high 2 / low 1');
	assert(an.byPriority[0].priority === 'high', 'higher priority sorts first');
	assert(an.byLabel.length === 1 && an.byLabel[0].name === 'bug' && an.byLabel[0].count === 2, 'bug label counted twice');

	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	await db.delete(schema.users).where(eq(schema.users.id, user.id));

	console.log('\n✅ smoke-analytics passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-analytics failed:', err);
	await closeDb();
	process.exit(1);
});
