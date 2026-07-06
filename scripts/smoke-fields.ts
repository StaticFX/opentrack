import '$lib/server/load-env';
import { eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import {
	createField,
	deleteField,
	fieldProject,
	getTicketFields,
	listFields,
	setTicketFieldValue
} from '$lib/server/services/custom-fields';
import { createProject } from '$lib/server/services/projects';
import { createTicket } from '$lib/server/services/tickets';
import { createWorkspace } from '$lib/server/services/workspaces';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}

async function main() {
	const [u] = await db.insert(schema.users).values({ username: `fld-${Date.now()}`, displayName: 'Fld' }).returning();
	const user: SessionUser = { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };
	const ws = await createWorkspace(user, { name: 'Fld WS' });
	const project = await createProject(user, { ...ws }, { name: 'Fld Proj' });
	const [board] = await listBoards(project.id);
	const todo = (await getBoardColumns(board.id)).find((c) => c.category === 'todo')!;
	const ticket = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: todo.id, title: 'Has fields' });

	console.log('[1] create fields; options only kept for select');
	const f1 = await createField(project.id, { name: 'Notes', type: 'text' });
	const f2 = await createField(project.id, { name: 'Severity', type: 'select', options: ['Low', 'High'] });
	const f3 = await createField(project.id, { name: 'Effort', type: 'number', options: ['ignored'] });
	const fields = await listFields(project.id);
	assert(fields.map((f) => f.name).join(',') === 'Notes,Severity,Effort', 'fields ordered by position');
	assert(fields.find((f) => f.id === f2)!.options!.join(',') === 'Low,High', 'select keeps options');
	assert(fields.find((f) => f.id === f3)!.options === null, 'non-select field drops options');

	console.log('[2] ticket fields merge defs with (initially empty) values');
	let tf = await getTicketFields(ticket.id, project.id);
	assert(tf.length === 3 && tf.every((f) => f.value === null), 'all values start null');

	console.log('[3] set + update is an upsert (no duplicate rows)');
	await setTicketFieldValue(ticket.id, f1, 'hello');
	await setTicketFieldValue(ticket.id, f1, 'world');
	await setTicketFieldValue(ticket.id, f2, 'High');
	const rows = await db.select().from(schema.ticketFieldValues).where(eq(schema.ticketFieldValues.ticketId, ticket.id));
	assert(rows.length === 2, 'exactly two value rows (f1 upserted, not duplicated)');
	tf = await getTicketFields(ticket.id, project.id);
	assert(tf.find((f) => f.id === f1)!.value === 'world', 'f1 updated to latest value');
	assert(tf.find((f) => f.id === f2)!.value === 'High', 'f2 select value set');

	console.log('[4] empty value clears the field');
	await setTicketFieldValue(ticket.id, f1, '');
	tf = await getTicketFields(ticket.id, project.id);
	assert(tf.find((f) => f.id === f1)!.value === null, 'cleared value returns null');

	console.log('[5] fieldProject authz helper + delete cascades values');
	assert((await fieldProject(f2)) === project.id, 'fieldProject resolves owning project');
	await setTicketFieldValue(ticket.id, f3, '5');
	await deleteField(f3);
	assert(!(await listFields(project.id)).some((f) => f.id === f3), 'field removed');
	const leftover = await db.select().from(schema.ticketFieldValues).where(eq(schema.ticketFieldValues.fieldId, f3));
	assert(leftover.length === 0, 'deleting a field cascades its ticket values');

	console.log('[6] ticket delete cascades field values');
	await db.delete(schema.tickets).where(eq(schema.tickets.id, ticket.id));
	const afterTicket = await db.select().from(schema.ticketFieldValues).where(eq(schema.ticketFieldValues.ticketId, ticket.id));
	assert(afterTicket.length === 0, 'ticket values cascade with the ticket');

	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	await db.delete(schema.users).where(eq(schema.users.id, user.id));

	console.log('\n✅ smoke-fields passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-fields failed:', err);
	await closeDb();
	process.exit(1);
});
