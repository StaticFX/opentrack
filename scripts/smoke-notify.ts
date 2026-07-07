import '$lib/server/load-env';
import { and, eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { createProject } from '$lib/server/services/projects';
import { createTicket } from '$lib/server/services/tickets';
import { createSuggestion } from '$lib/server/services/suggestions';
import { createWorkspace } from '$lib/server/services/workspaces';
import {
	countPushSubscriptions,
	deletePushSubscription,
	isWatching,
	listNotifications,
	listProjectMaintainerIds,
	listWatchers,
	markRead,
	notifyUsers,
	notifyWatchers,
	parseMentions,
	resolveMentions,
	savePushSubscription,
	subjectRef,
	unreadCount,
	unwatch,
	watch
} from '$lib/server/services/notifications';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}

async function mkUser(name: string): Promise<SessionUser> {
	const [u] = await db
		.insert(schema.users)
		.values({ username: `${name}-${Date.now()}-${Math.floor(performance.now())}`, displayName: name })
		.returning();
	return { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };
}

async function main() {
	const alice = await mkUser('alice'); // owner / maintainer
	const bob = await mkUser('bob'); // collaborator / actor
	const carol = await mkUser('carol'); // mentioned

	const ws = await createWorkspace(alice, { name: 'Notify WS' });
	const project = await createProject(alice, { ...ws }, { name: 'Notify Proj' });
	const [board] = await listBoards(project.id);
	const cols = await getBoardColumns(board.id);
	const todo = cols.find((c) => c.category === 'todo')!;
	const done = cols.find((c) => c.category === 'done')!;
	const ticket = await createTicket(alice, { projectId: project.id, boardId: board.id, columnId: todo.id, title: 'Crash on load' });

	console.log('[1] watch / isWatching / listWatchers / unwatch');
	await watch('ticket', ticket.id, alice.id, 'author');
	await watch('ticket', ticket.id, alice.id, 'author'); // idempotent
	assert(await isWatching('ticket', ticket.id, alice.id), 'alice is watching');
	assert(!(await isWatching('ticket', ticket.id, bob.id)), 'bob is not watching');
	assert((await listWatchers('ticket', ticket.id)).length === 1, 'exactly one watcher after dedup');
	await unwatch('ticket', ticket.id, alice.id);
	assert(!(await isWatching('ticket', ticket.id, alice.id)), 'unwatch removed alice');
	await watch('ticket', ticket.id, alice.id, 'author'); // re-add for later

	console.log('[2] subjectRef builds viewable deep links');
	const tref = await subjectRef('ticket', ticket.id);
	assert(tref?.url === `/${ws.slug}/${project.slug}/t/${ticket.number}`, `ticket url ${tref?.url}`);
	assert(tref?.projectId === project.id, 'ticket ref resolves projectId');
	assert(tref?.title.includes('Crash on load'), 'ticket ref title includes ticket title');

	console.log('[3] @mention parsing + resolution');
	const mentions = parseMentions(`hey @${carol.username} and @${bob.username}, also email a@b.com not @x`);
	assert(mentions.includes(carol.username.toLowerCase()), 'parsed carol');
	assert(mentions.includes(bob.username.toLowerCase()), 'parsed bob');
	assert(!mentions.includes('b.com'), 'did not treat email as mention');
	const resolved = await resolveMentions(mentions);
	assert(resolved.includes(carol.id) && resolved.includes(bob.id), 'resolved mention ids');

	console.log('[4] notifyWatchers excludes the actor; rows + push jobs enqueued');
	await watch('ticket', ticket.id, bob.id, 'commented'); // bob now also watches
	const jobsBefore = (await db.select().from(schema.jobs).where(eq(schema.jobs.queue, 'notify:push'))).length;
	await notifyWatchers({ type: 'ticket.commented', subjectType: 'ticket', subjectId: ticket.id, actorId: bob.id, body: 'Bob commented' });
	const aliceNotifs = await listNotifications(alice.id, {});
	assert(aliceNotifs.length === 1, 'alice got 1 notification');
	assert(aliceNotifs[0].title === tref?.title, 'notification title = subject title');
	assert(aliceNotifs[0].body === 'Bob commented', 'notification body = action line');
	assert(aliceNotifs[0].url === tref?.url, 'notification carries deep link');
	// subjectType is what lets the in-app inbox/bell rewrite the public ticket
	// url to the internal ticket route (see notificationHref in $lib/notifications).
	assert(aliceNotifs[0].subjectType === 'ticket', 'notification carries subjectType');
	assert((await listNotifications(bob.id, {})).length === 0, 'actor (bob) not notified');
	const jobsAfter = (await db.select().from(schema.jobs).where(eq(schema.jobs.queue, 'notify:push'))).length;
	assert(jobsAfter === jobsBefore + 1, 'one push job enqueued (one recipient)');

	console.log('[5] unreadCount + markRead');
	await notifyUsers([alice.id], { type: 'mention', subjectType: 'ticket', subjectId: ticket.id, actorId: bob.id, body: 'Bob mentioned you' });
	assert((await unreadCount(alice.id)) === 2, 'alice has 2 unread');
	const first = (await listNotifications(alice.id, {}))[0];
	await markRead(alice.id, [first.id]);
	assert((await unreadCount(alice.id)) === 1, 'marking one read leaves 1 unread');
	await markRead(alice.id);
	assert((await unreadCount(alice.id)) === 0, 'markRead(all) clears unread');

	console.log('[6] suggestion subjectRef + maintainer targeting');
	const sugId = await createSuggestion(bob, project.id, { title: 'Add dark mode', body: 'please' });
	const sref = await subjectRef('suggestion', sugId);
	assert(sref?.url === `/${ws.slug}/${project.slug}/suggestions/${sugId}`, `suggestion url ${sref?.url}`);
	const maints = await listProjectMaintainerIds(project.id);
	assert(maints.includes(alice.id), 'workspace owner is a maintainer target');
	assert(!maints.includes(bob.id), 'plain author is not a maintainer target');

	console.log('[7] push subscription store: upsert on endpoint + delete');
	await savePushSubscription(alice.id, { endpoint: 'https://push.example/abc', p256dh: 'k1', auth: 'a1' });
	await savePushSubscription(alice.id, { endpoint: 'https://push.example/abc', p256dh: 'k2', auth: 'a2' }); // same endpoint → upsert
	assert((await countPushSubscriptions(alice.id)) === 1, 'endpoint upsert keeps a single row');
	await savePushSubscription(alice.id, { endpoint: 'https://push.example/def', p256dh: 'k3', auth: 'a3' });
	assert((await countPushSubscriptions(alice.id)) === 2, 'second device adds a row');
	await deletePushSubscription(alice.id, 'https://push.example/abc');
	assert((await countPushSubscriptions(alice.id)) === 1, 'delete removes one');

	console.log('[8] closing a ticket is a notifiable event (move to done column)');
	// Simulate the move endpoint's watcher fan-out.
	await notifyWatchers({ type: 'ticket.closed', subjectType: 'ticket', subjectId: ticket.id, actorId: bob.id, body: `Bob closed this (${done.name})` });
	const closed = await listNotifications(alice.id, { unreadOnly: true });
	assert(closed.some((n) => n.type === 'ticket.closed'), 'alice notified of close');

	// cleanup
	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	for (const u of [alice, bob, carol]) await db.delete(schema.users).where(eq(schema.users.id, u.id));
	await db.delete(schema.jobs).where(eq(schema.jobs.queue, 'notify:push'));
	// notifications/watchers/push_subscriptions cascade via users FK.
	void and;

	console.log('\n✅ smoke-notify passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-notify failed:', err);
	await closeDb();
	process.exit(1);
});
