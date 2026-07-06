import '$lib/server/load-env';
import { eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import {
	addChecklistItem,
	checklistItemTicket,
	deleteChecklistItem,
	listChecklist,
	updateChecklistItem
} from '$lib/server/services/checklists';
import { createProject } from '$lib/server/services/projects';
import { createTicket } from '$lib/server/services/tickets';
import { createWorkspace } from '$lib/server/services/workspaces';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}

async function main() {
	const [u] = await db.insert(schema.users).values({ username: `chk-${Date.now()}`, displayName: 'Chk' }).returning();
	const user: SessionUser = { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };
	const ws = await createWorkspace(user, { name: 'Chk WS' });
	const project = await createProject(user, { ...ws }, { name: 'Chk Proj' });
	const [board] = await listBoards(project.id);
	const todo = (await getBoardColumns(board.id)).find((c) => c.category === 'todo')!;
	const ticket = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: todo.id, title: 'Build feature' });

	console.log('[1] add items keep insertion order');
	const a = await addChecklistItem(ticket.id, 'Write code');
	const b = await addChecklistItem(ticket.id, 'Write tests');
	const c = await addChecklistItem(ticket.id, 'Ship it');
	let list = await listChecklist(ticket.id);
	assert(list.map((i) => i.text).join(',') === 'Write code,Write tests,Ship it', 'ordered by position');
	assert(list.every((i) => !i.done), 'new items start unchecked');

	console.log('[2] toggle + rename');
	await updateChecklistItem(b.id, { done: true });
	await updateChecklistItem(a.id, { text: 'Write the code' });
	list = await listChecklist(ticket.id);
	assert(list.find((i) => i.id === b.id)!.done, 'item marked done');
	assert(list.find((i) => i.id === a.id)!.text === 'Write the code', 'item renamed');

	console.log('[3] item → ticket resolution (for authz)');
	assert((await checklistItemTicket(a.id)) === ticket.id, 'checklistItemTicket resolves owner ticket');
	assert((await checklistItemTicket('nope')) === null, 'missing item → null');

	console.log('[4] delete one');
	await deleteChecklistItem(c.id);
	list = await listChecklist(ticket.id);
	assert(list.length === 2 && !list.some((i) => i.id === c.id), 'item deleted');

	console.log('[5] cascade on ticket delete');
	await db.delete(schema.tickets).where(eq(schema.tickets.id, ticket.id));
	assert((await listChecklist(ticket.id)).length === 0, 'checklist cascades with ticket');

	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	await db.delete(schema.users).where(eq(schema.users.id, user.id));

	console.log('\n✅ smoke-checklists passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-checklists failed:', err);
	await closeDb();
	process.exit(1);
});
