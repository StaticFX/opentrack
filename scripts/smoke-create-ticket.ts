import '$lib/server/load-env';
import { and, asc, eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import { createTicket, setAssignee, setLabel } from '$lib/server/services/tickets';
import { isWatching, watch } from '$lib/server/services/notifications';
import { listBoards } from '$lib/server/services/boards';
import { createProject } from '$lib/server/services/projects';
import { createWorkspace, deleteWorkspace } from '$lib/server/services/workspaces';
import type { SessionUser } from '$lib/server/auth/session';

function assert(c: unknown, m: string) {
	if (!c) throw new Error('FAIL: ' + m);
	console.log('  ✓ ' + m);
}

async function main() {
	// Author + a project member to assign.
	const [author] = await db.insert(schema.users).values({ username: 'ct-author', displayName: 'Author', email: 'ct-a@example.com' }).returning();
	const [member] = await db.insert(schema.users).values({ username: 'ct-member', displayName: 'Member', email: 'ct-m@example.com' }).returning();
	const su: SessionUser = { id: author.id, username: author.username, displayName: author.displayName, email: author.email, isAdmin: false, avatarUrl: null } as SessionUser;
	const ws = await createWorkspace(su, { name: 'CTWs', slug: 'ct-ws-smoke' });
	const project = await createProject(su, ws, { name: 'CTProj' });
	const [board] = await listBoards(project.id);
	const [col] = await db.select().from(schema.boardColumns).where(eq(schema.boardColumns.boardId, board.id)).orderBy(asc(schema.boardColumns.position)).limit(1);
	const [label] = await db.insert(schema.labels).values({ projectId: project.id, name: 'ux', color: '#8b5cf6' }).returning();

	try {
		console.log('[1] create with description + priority + label + assignee (endpoint composition)');
		// Mirror POST /api/boards/[boardId]/tickets exactly.
		const ticket = await createTicket(su, {
			projectId: project.id,
			boardId: board.id,
			columnId: col.id,
			title: 'Rich ticket',
			description: 'body **md**',
			priority: 'high'
		});
		await setLabel(ticket.id, label.id, true);
		await setAssignee(ticket.id, member.id, true);
		await watch('ticket', ticket.id, member.id, 'assignee');
		await watch('ticket', ticket.id, author.id, 'author');

		const [row] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id));
		assert(row.title === 'Rich ticket' && row.description === 'body **md**', 'title + description stored');
		assert(row.priority === 'high', 'priority stored');
		assert(row.columnId === col.id, 'placed in the chosen column');
		assert(row.authorId === author.id, 'author recorded');

		const labels = await db.select().from(schema.ticketLabels).where(and(eq(schema.ticketLabels.ticketId, ticket.id), eq(schema.ticketLabels.labelId, label.id)));
		assert(labels.length === 1, 'label attached');
		const assignees = await db.select().from(schema.ticketAssignees).where(eq(schema.ticketAssignees.ticketId, ticket.id));
		assert(assignees.length === 1 && assignees[0].userId === member.id, 'assignee attached');
		assert(await isWatching('ticket', ticket.id, member.id), 'assignee auto-watches');
		assert(await isWatching('ticket', ticket.id, author.id), 'author auto-watches');

		console.log('\n[2] sequential ticket numbering still holds');
		const t2 = await createTicket(su, { projectId: project.id, boardId: board.id, columnId: col.id, title: 'Second' });
		assert(t2.number === row.number + 1, 'second ticket gets next number');

		console.log('\n[smoke-create-ticket] ✓ all checks passed');
	} finally {
		await deleteWorkspace(ws.id).catch(() => {});
		await db.delete(schema.users).where(eq(schema.users.id, author.id)).catch(() => {});
		await db.delete(schema.users).where(eq(schema.users.id, member.id)).catch(() => {});
	}
	await closeDb();
}

main().catch(async (e) => {
	console.error(e);
	await closeDb();
	process.exit(1);
});
