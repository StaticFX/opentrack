import '$lib/server/load-env';
import { asc, eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import { listAssignedTo, listDueSoon, listWatching } from '$lib/server/services/mywork';
import { setAssignee } from '$lib/server/services/tickets';
import { watch } from '$lib/server/services/notifications';
import { createProject } from '$lib/server/services/projects';
import { listBoards } from '$lib/server/services/boards';
import { createWorkspace, deleteWorkspace } from '$lib/server/services/workspaces';
import type { SessionUser } from '$lib/server/auth/session';

function assert(c: unknown, m: string) {
	if (!c) throw new Error('FAIL: ' + m);
	console.log('  ✓ ' + m);
}
const su = (u: { id: string; username: string; displayName: string; email: string | null }): SessionUser =>
	({ id: u.id, username: u.username, displayName: u.displayName, email: u.email, isAdmin: false, avatarUrl: null }) as SessionUser;

async function main() {
	const [alice] = await db.insert(schema.users).values({ username: 'mw-alice', displayName: 'Alice', email: 'mw-a@e.com' }).returning();
	const [bob] = await db.insert(schema.users).values({ username: 'mw-bob', displayName: 'Bob', email: 'mw-b@e.com' }).returning();
	const A = su(alice), B = su(bob);
	// Alice owns her workspace; Bob owns a separate one he can see but Alice can't.
	const wsA = await createWorkspace(A, { name: 'MWAlice', slug: 'mw-alice-ws' });
	const projA = await createProject(A, wsA, { name: 'PA' });
	const [boardA] = await listBoards(projA.id);
	const [colA] = await db.select().from(schema.boardColumns).where(eq(schema.boardColumns.boardId, boardA.id)).orderBy(asc(schema.boardColumns.position)).limit(1);

	const wsB = await createWorkspace(B, { name: 'MWBob', slug: 'mw-bob-ws' });
	const projB = await createProject(B, wsB, { name: 'PB' });
	const [boardB] = await listBoards(projB.id);
	const [colB] = await db.select().from(schema.boardColumns).where(eq(schema.boardColumns.boardId, boardB.id)).orderBy(asc(schema.boardColumns.position)).limit(1);

	const now = new Date();
	const soon = new Date(now.getTime() + 2 * 86_400_000); // in 2 days
	const later = new Date(now.getTime() + 30 * 86_400_000); // in 30 days
	const past = new Date(now.getTime() - 86_400_000); // overdue

	async function mkTicket(projectId: string, boardId: string, columnId: string, num: number, title: string, opts: { due?: Date; closed?: boolean } = {}) {
		const [t] = await db.insert(schema.tickets).values({
			projectId, boardId, columnId, number: num, title, position: `a${num}`,
			dueDate: opts.due ?? null, closedAt: opts.closed ? now : null
		}).returning();
		return t;
	}

	try {
		// Alice's project tickets.
		const t1 = await mkTicket(projA.id, boardA.id, colA.id, 1, 'Alice assigned soon', { due: soon });
		const t2 = await mkTicket(projA.id, boardA.id, colA.id, 2, 'Alice assigned later', { due: later });
		const t3 = await mkTicket(projA.id, boardA.id, colA.id, 3, 'Alice assigned closed', { closed: true, due: soon });
		const t4 = await mkTicket(projA.id, boardA.id, colA.id, 4, 'Alice watches only');
		// Bob's project ticket, assigned to Alice? No — assign to Bob (Alice shouldn't see it).
		const tb = await mkTicket(projB.id, boardB.id, colB.id, 1, 'Bob private', { due: past });

		await setAssignee(t1.id, alice.id, true);
		await setAssignee(t2.id, alice.id, true);
		await setAssignee(t3.id, alice.id, true); // closed → excluded
		await setAssignee(tb.id, bob.id, true);
		await watch('ticket', t4.id, alice.id, 'manual');

		console.log('[1] assigned-to lists only open assigned tickets');
		const assigned = await listAssignedTo(A);
		const aIds = assigned.map((t) => t.id);
		assert(aIds.includes(t1.id) && aIds.includes(t2.id), 'both open assigned tickets present');
		assert(!aIds.includes(t3.id), 'closed assigned ticket excluded');
		assert(!aIds.includes(t4.id), 'watched-but-unassigned excluded from assigned');
		assert(assigned.every((t) => t.url === `/${t.wsSlug}/${t.projSlug}/t/${t.number}`), 'deep-link url shape');

		console.log('\n[2] due-soon = overdue + within window, sorted, open, assigned');
		const due = await listDueSoon(A, 7, now);
		const dIds = due.map((t) => t.id);
		assert(dIds.includes(t1.id), 'ticket due in 2 days is in due-soon');
		assert(!dIds.includes(t2.id), 'ticket due in 30 days is NOT in due-soon (7-day window)');
		assert(!dIds.includes(t3.id), 'closed ticket excluded from due-soon');

		console.log('\n[3] watching lists watched open tickets');
		const watching = await listWatching(A);
		const wIds = watching.map((t) => t.id);
		assert(wIds.includes(t4.id), 'manually-watched ticket present');

		console.log('\n[4] access scoping — Alice never sees Bob-only project data');
		assert(!aIds.includes(tb.id) && !dIds.includes(tb.id), "Bob's assigned ticket absent from Alice's lists");
		const bobAssigned = await listAssignedTo(B);
		assert(bobAssigned.some((t) => t.id === tb.id), 'Bob sees his own assigned ticket');
		assert(!bobAssigned.some((t) => t.projSlug === projA.slug), 'Bob sees nothing from Alice-only project');

		console.log('\n[smoke-mywork] ✓ all checks passed');
	} finally {
		await deleteWorkspace(wsA.id).catch(() => {});
		await deleteWorkspace(wsB.id).catch(() => {});
		await db.delete(schema.users).where(eq(schema.users.id, alice.id)).catch(() => {});
		await db.delete(schema.users).where(eq(schema.users.id, bob.id)).catch(() => {});
	}
	await closeDb();
}

main().catch(async (e) => {
	console.error(e);
	await closeDb();
	process.exit(1);
});
