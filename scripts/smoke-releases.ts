import '$lib/server/load-env';
import { and, eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { applyWebhookEvent } from '$lib/server/github/sync';
import { listBoards, getBoardColumns } from '$lib/server/services/boards';
import { createProject } from '$lib/server/services/projects';
import {
	addLink,
	addTicketByNumber,
	createRelease,
	getReleaseDetail,
	listReleases,
	updateRelease
} from '$lib/server/services/releases';
import { createTicket } from '$lib/server/services/tickets';
import { createWorkspace } from '$lib/server/services/workspaces';

function assert(c: unknown, m: string) {
	if (!c) throw new Error('FAIL: ' + m);
	console.log('  ✓ ' + m);
}

async function main() {
	const [u] = await db.insert(schema.users).values({ username: `rel-${Date.now()}`, displayName: 'Rel' }).returning();
	const user: SessionUser = { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };
	const ws = await createWorkspace(user, { name: 'Rel WS' });
	const project = await createProject(user, { ...ws }, { name: 'Rel Proj' });
	await db.update(schema.projects).set({ githubRepo: 'acme/rel', githubInstallationId: '1' }).where(eq(schema.projects.id, project.id));
	const [board] = await listBoards(project.id);
	const [col] = await getBoardColumns(board.id);

	console.log('[1] create + publish stamps releasedAt');
	const id = await createRelease(project.id, { version: 'v1.0.0' });
	let [rel] = await db.select().from(schema.releases).where(eq(schema.releases.id, id));
	assert(rel.status === 'draft' && rel.releasedAt === null, 'created as draft, no releasedAt');
	await updateRelease(id, { status: 'published', notes: '### Highlights' });
	[rel] = await db.select().from(schema.releases).where(eq(schema.releases.id, id));
	assert(rel.status === 'published' && rel.releasedAt !== null, 'published stamps releasedAt');

	console.log('[2] links + shipped tickets');
	await addLink(id, { label: 'Download', url: 'https://x/dl', type: 'download' });
	const ticket = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: col.id, title: 'Shipped feature' });
	assert(await addTicketByNumber(id, project.id, ticket.number), 'associate ticket by number');
	assert(!(await addTicketByNumber(id, project.id, 9999)), 'unknown ticket number rejected');
	const detail = await getReleaseDetail(id);
	assert(detail!.links.length === 1 && detail!.tickets.length === 1, 'detail has 1 link + 1 ticket');

	console.log('[3] listReleases publishedOnly');
	await createRelease(project.id, { version: 'v0.9-draft' }); // draft
	assert((await listReleases(project.id, { publishedOnly: true })).length === 1, 'publishedOnly filters drafts');
	assert((await listReleases(project.id)).length === 2, 'all includes draft');

	console.log('[4] inbound GitHub release → creates release + github link');
	await applyWebhookEvent('release', 'published', {
		repository: { full_name: 'acme/rel' },
		release: { id: 700, tag_name: 'v2.0.0', name: 'Big one', body: 'notes', draft: false, published_at: '2026-01-01T00:00:00Z', html_url: 'https://github.com/acme/rel/releases/v2.0.0' }
	});
	const [synced] = await db.select().from(schema.releases).where(and(eq(schema.releases.projectId, project.id), eq(schema.releases.githubReleaseId, '700')));
	assert(synced && synced.version === 'v2.0.0' && synced.status === 'published', 'GitHub release synced');
	const ghLinks = await db.select().from(schema.releaseLinks).where(eq(schema.releaseLinks.releaseId, synced.id));
	assert(ghLinks.length === 1 && ghLinks[0].type === 'github', 'github link attached');
	// idempotent update
	await applyWebhookEvent('release', 'edited', { repository: { full_name: 'acme/rel' }, release: { id: 700, tag_name: 'v2.0.0', name: 'Renamed', body: 'notes2', draft: false, html_url: 'x' } });
	const [again] = await db.select().from(schema.releases).where(eq(schema.releases.id, synced.id));
	assert(again.name === 'Renamed', 'release edit updates in place (no dupe)');

	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	await db.delete(schema.users).where(eq(schema.users.id, u.id));
	console.log('\n[smoke-releases] ✓ all checks passed');
	await closeDb();
}

main().catch((e) => {
	console.error('\n[smoke-releases] FAILED:', e);
	process.exit(1);
});
