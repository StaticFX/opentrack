import '$lib/server/load-env';
import { and, eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import { createWorkspace } from '$lib/server/services/workspaces';
import { createProject } from '$lib/server/services/projects';
import { listBoards, getBoardColumns } from '$lib/server/services/boards';
import { createTicket } from '$lib/server/services/tickets';
import { listNotifications, notifyWatchers, unreadCount, watch } from '$lib/server/services/notifications';
import type { SessionUser } from '$lib/server/auth/session';

function assert(c: unknown, m: string) {
	if (!c) throw new Error('FAIL: ' + m);
	console.log('  ✓ ' + m);
}
const su = (u: typeof schema.users.$inferSelect): SessionUser =>
	({ id: u.id, username: u.username, displayName: u.displayName, email: u.email, isAdmin: false, avatarUrl: null }) as SessionUser;

async function main() {
	const [alice] = await db.insert(schema.users).values({ username: 'alice', displayName: 'Alice', email: 'a@x.io' }).returning();
	const [bob] = await db.insert(schema.users).values({ username: 'bob', displayName: 'Bob', email: 'b@x.io' }).returning();

	const ws = await createWorkspace(su(alice), { name: 'Acme', slug: 'acme-wn' });
	const project = await createProject(su(alice), ws, { name: 'Proj' });
	const [board] = await listBoards(project.id);
	const cols = await getBoardColumns(board.id);
	const ticket = await createTicket(su(alice), {
		projectId: project.id,
		boardId: board.id,
		columnId: cols[0].id,
		title: 'Watch me'
	});

	console.log('[1] Bob watches the ticket');
	await watch('ticket', ticket.id, bob.id, 'manual');

	console.log('[2] Alice updates the ticket → notifyWatchers (the endpoint fan-out)');
	await notifyWatchers({
		type: 'ticket.updated',
		subjectType: 'ticket',
		subjectId: ticket.id,
		actorId: alice.id,
		body: `${alice.displayName} updated the priority`
	});

	const bobUnread = await unreadCount(bob.id);
	const bobList = await listNotifications(bob.id);
	assert(bobUnread === 1, 'Bob (watcher) has 1 unread notification');
	assert(bobList[0]?.type === 'ticket.updated', 'notification type is ticket.updated');
	assert(bobList[0]?.title.includes('Watch me'), 'notification title = ticket title');
	assert(bobList[0]?.body === 'Alice updated the priority', 'body describes the change');
	assert(bobList[0]?.url.endsWith(`/t/${ticket.number}`), 'deep link points at the ticket');

	console.log('[3] Alice (the actor) is NOT notified of her own change');
	assert((await unreadCount(alice.id)) === 0, 'actor gets no self-notification');

	console.log('\n[smoke-watch-notify] ✓ all checks passed');
	await closeDb();
}
main().catch(async (e) => {
	console.error(e);
	await closeDb();
	process.exit(1);
});
