import '$lib/server/load-env';
import { eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { createLabel } from '$lib/server/services/labels';
import { createProject } from '$lib/server/services/projects';
import { createRelease, generateChangelogDraft } from '$lib/server/services/releases';
import { createTicket, setLabel } from '$lib/server/services/tickets';
import { createWorkspace } from '$lib/server/services/workspaces';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}

async function main() {
	const [u] = await db.insert(schema.users).values({ username: `cl-${Date.now()}`, displayName: 'CL' }).returning();
	const user: SessionUser = { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };
	const ws = await createWorkspace(user, { name: 'CL WS' });
	const project = await createProject(user, { ...ws }, { name: 'CL Proj' });
	const [board] = await listBoards(project.id);
	const todo = (await getBoardColumns(board.id)).find((c) => c.category === 'todo')!;

	const cutoff = new Date('2026-03-01T00:00:00Z');
	const before = new Date(cutoff.getTime() - 3600_000);
	const after = new Date(cutoff.getTime() + 3600_000);

	// Previous published release stamped at the cutoff.
	const r1 = await createRelease(project.id, { version: 'v1.0.0' });
	await db.update(schema.releases).set({ status: 'published', releasedAt: cutoff }).where(eq(schema.releases.id, r1));
	// The draft we're generating notes for.
	const r2 = await createRelease(project.id, { version: 'v1.1.0' });

	const bug = await createLabel(project.id, { name: 'Bug', color: '#ef4444' });
	const feat = await createLabel(project.id, { name: 'Feature', color: '#22c55e' });

	const mk = async (title: string) => createTicket(user, { projectId: project.id, boardId: board.id, columnId: todo.id, title });
	const tOld = await mk('Ancient fix');
	const tBug = await mk('Crash on save');
	const tFeat = await mk('Add dark mode');
	const tPlain = await mk('Misc tidy up');
	await setLabel(tBug.id, bug.id, true);
	await setLabel(tFeat.id, feat.id, true);
	// Close them at controlled times.
	await db.update(schema.tickets).set({ closedAt: before }).where(eq(schema.tickets.id, tOld.id));
	await db.update(schema.tickets).set({ closedAt: after }).where(eq(schema.tickets.id, tBug.id));
	await db.update(schema.tickets).set({ closedAt: after }).where(eq(schema.tickets.id, tFeat.id));
	await db.update(schema.tickets).set({ closedAt: after }).where(eq(schema.tickets.id, tPlain.id));

	console.log('[1] draft groups shipped tickets by label');
	const draft = await generateChangelogDraft(project.id, r2);
	assert(draft.includes('### Bug') && draft.includes(`#${tBug.number} Crash on save`), 'Bug section lists the bug ticket');
	assert(draft.includes('### Feature') && draft.includes(`#${tFeat.number} Add dark mode`), 'Feature section lists the feature ticket');
	assert(draft.includes('### Changes') && draft.includes(`#${tPlain.number} Misc tidy up`), 'unlabeled ticket under Changes');

	console.log('[2] tickets closed before the previous release are excluded');
	assert(!draft.includes('Ancient fix'), 'pre-cutoff ticket excluded');

	console.log('[3] Changes (unlabeled) sorts last');
	assert(draft.indexOf('### Changes') > draft.indexOf('### Bug') && draft.indexOf('### Changes') > draft.indexOf('### Feature'), 'Changes group is last');

	console.log('[4] empty when nothing shipped since cutoff');
	// A fresh project with no closed tickets → empty draft.
	const p2 = await createProject(user, { ...ws }, { name: 'Empty' });
	const r3 = await createRelease(p2.id, { version: 'v0.1' });
	assert((await generateChangelogDraft(p2.id, r3)) === '', 'no shipped tickets → empty string');

	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	await db.delete(schema.users).where(eq(schema.users.id, user.id));

	console.log('\n✅ smoke-changelog passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-changelog failed:', err);
	await closeDb();
	process.exit(1);
});
