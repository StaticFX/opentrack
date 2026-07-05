import '$lib/server/load-env';
import { and, eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { createColumn, deleteColumn, updateColumn } from '$lib/server/services/columns';
import { addComment, listComments } from '$lib/server/services/comments';
import { createLabel } from '$lib/server/services/labels';
import { createProject } from '$lib/server/services/projects';
import {
	addRelation,
	createTicket,
	getTicketDetail,
	listBoardTickets,
	moveTicket,
	setAssignee,
	setLabel
} from '$lib/server/services/tickets';
import { toggleVote } from '$lib/server/services/votes';
import { createWorkspace } from '$lib/server/services/workspaces';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}

async function main() {
	const [u] = await db
		.insert(schema.users)
		.values({ username: `boarder-${Date.now()}`, displayName: 'Boarder' })
		.returning();
	const user: SessionUser = {
		id: u.id,
		username: u.username,
		displayName: u.displayName,
		email: null,
		avatarUrl: null,
		isAdmin: false
	};

	console.log('[1] project auto-creates board + columns');
	const ws = await createWorkspace(user, { name: 'Board WS' });
	const project = await createProject(user, { ...ws }, { name: 'Board Proj' });
	const [board] = await listBoards(project.id);
	const columns = await getBoardColumns(board.id);
	assert(columns.length === 4, `4 default columns (${columns.map((c) => c.name).join(', ')})`);
	const todo = columns.find((c) => c.category === 'todo')!;
	const done = columns.find((c) => c.category === 'done')!;

	console.log('[2] create tickets with sequential numbers');
	const t1 = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: todo.id, title: 'First', priority: 'high' });
	const t2 = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: todo.id, title: 'Second' });
	assert(t1.number === 1 && t2.number === 2, `numbers 1,2 assigned (${t1.number},${t2.number})`);
	assert(t1.position < t2.position, 'positions ordered within column');

	console.log('[3] labels + assignees + votes + comments');
	const label = await createLabel(project.id, { name: 'bug', color: '#ef4444' });
	await setLabel(t1.id, label.id, true);
	await setAssignee(t1.id, user.id, true);
	const v1 = await toggleVote('ticket', t1.id, { userId: user.id });
	assert(v1.voted && v1.count === 1, 'vote added (count 1)');
	const v2 = await toggleVote('ticket', t1.id, { userId: user.id });
	assert(!v2.voted && v2.count === 0, 'vote toggled off (count 0)');
	await toggleVote('ticket', t1.id, { userId: user.id }); // back to 1
	await addComment('ticket', t1.id, user.id, 'Looks important');
	assert((await listComments('ticket', t1.id)).length === 1, 'comment stored');

	console.log('[4] board listing reflects labels/assignees/votes/comments');
	const cards = await listBoardTickets(board.id);
	const c1 = cards.find((c) => c.id === t1.id)!;
	assert(c1.labels.length === 1 && c1.labels[0].name === 'bug', 'card shows label');
	assert(c1.assignees.length === 1, 'card shows assignee');
	assert(c1.votes === 1 && c1.comments === 1, `card counts votes=${c1.votes} comments=${c1.comments}`);

	console.log('[5] move to done sets closedAt; relation');
	await moveTicket(t1.id, done.id, 'z');
	const detail = await getTicketDetail(t1.id);
	assert(detail!.columnId === done.id && detail!.closedAt !== null, 'moved to done + closedAt set');
	await addRelation(t1.id, t2.id, 'relates');
	assert((await getTicketDetail(t1.id))!.relations.length === 1, 'relation added');
	await moveTicket(t1.id, todo.id, 'a');
	assert((await getTicketDetail(t1.id))!.closedAt === null, 'moving back to todo clears closedAt');

	console.log('[6] columns: create, update, delete-guard');
	const newCol = await createColumn(board.id, { name: 'Review', category: 'in_progress', color: '#a855f7' });
	await updateColumn(newCol.id, { name: 'In Review', wipLimit: 3 });
	const updated = (await getBoardColumns(board.id)).find((c) => c.id === newCol.id)!;
	assert(updated.name === 'In Review' && updated.wipLimit === 3, 'column updated (name + wip)');
	const okDelete = await deleteColumn(board.id, newCol.id);
	assert(okDelete, 'column deleted (had >1)');
	// deleting down to the last column should be refused
	const remaining = await getBoardColumns(board.id);
	for (const c of remaining.slice(1)) await deleteColumn(board.id, c.id);
	const last = await getBoardColumns(board.id);
	const refuse = await deleteColumn(board.id, last[0].id);
	assert(!refuse && (await getBoardColumns(board.id)).length === 1, 'cannot delete the last column');

	// cleanup
	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	await db.delete(schema.users).where(eq(schema.users.id, user.id));
	console.log('\n[smoke-board] ✓ all checks passed');
	await closeDb();
}

main().catch((err) => {
	console.error('\n[smoke-board] FAILED:', err);
	process.exit(1);
});
