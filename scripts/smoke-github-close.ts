import '$lib/server/load-env';
import { eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import { shouldCloseIssue, ticketToIssue } from '$lib/server/github/map';
import { closeIssue } from '$lib/server/github/sync';
import { enqueueIssueCloseForTicket } from '$lib/server/github/enqueue';
import type { OctokitLike } from '$lib/server/github/import';
import { createProject } from '$lib/server/services/projects';
import { listBoards } from '$lib/server/services/boards';
import { createWorkspace, deleteWorkspace } from '$lib/server/services/workspaces';
import type { SessionUser } from '$lib/server/auth/session';

function assert(c: unknown, m: string) {
	if (!c) throw new Error('FAIL: ' + m);
	console.log('  ✓ ' + m);
}

const repo = 'acme/close';

async function closeIssueJobs() {
	const rows = await db.select().from(schema.jobs).where(eq(schema.jobs.queue, 'github:close-issue'));
	return rows.filter((r) => (r.payload as Record<string, unknown>)?.repoFullName === repo);
}

async function main() {
	console.log('[1] shouldCloseIssue — configured columns override category');
	assert(shouldCloseIssue(['Shipped'], 'Shipped', 'in_progress') === true, 'ticket in a configured close column → close (even if category not done)');
	assert(shouldCloseIssue(['Shipped'], 'Done', 'done') === false, 'category-done column NOT in the configured set → stays open');
	assert(shouldCloseIssue(null, 'Done', 'done') === true, 'no config → fall back to category done → close');
	assert(shouldCloseIssue([], 'Backlog', 'backlog') === false, 'no config + backlog → open');
	assert(shouldCloseIssue(null, 'Canceled', 'canceled') === true, 'no config + canceled category → close');

	console.log('\n[2] ticketToIssue closed override + state_reason');
	const t = { title: 'x', description: null };
	assert(ticketToIssue(t, 'in_progress', [], true).state === 'closed', 'override true on in_progress → closed');
	assert(ticketToIssue(t, 'in_progress', [], true).stateReason === 'completed', 'closed non-canceled → completed');
	assert(ticketToIssue(t, 'canceled', [], true).stateReason === 'not_planned', 'closed canceled → not_planned');
	assert(ticketToIssue(t, 'done', [], false).state === 'open', 'override false on done → open');
	assert(ticketToIssue(t, 'done', [], false).stateReason === 'reopened', 'open → reopened');
	assert(ticketToIssue(t, 'done', []).state === 'closed', 'no override → category drives it (done → closed)');

	console.log('\n[3] closeIssue PATCHes the issue closed via injected Octokit');
	const calls: Array<{ route: string; params: Record<string, unknown> }> = [];
	const fake: OctokitLike = {
		async request(route: string, params?: Record<string, unknown>) {
			calls.push({ route, params: params ?? {} });
			return { data: {} };
		}
	};
	await closeIssue('1', repo, 42, 'not_planned', fake);
	assert(calls.length === 1 && calls[0].route === 'PATCH /repos/{owner}/{repo}/issues/{issue_number}', 'PATCH issue route called');
	assert(calls[0].params.state === 'closed' && calls[0].params.state_reason === 'not_planned' && calls[0].params.issue_number === 42, 'state closed + not_planned + right issue number');
	assert(calls[0].params.owner === 'acme' && calls[0].params.repo === 'close', 'repo parsed into owner/repo');

	// ── DB fixtures for the delete-enqueue path ──
	const [user] = await db
		.insert(schema.users)
		.values({ username: 'close-smoke', displayName: 'Close Smoke', email: 'close@example.com' })
		.returning();
	const su: SessionUser = { id: user.id, username: user.username, displayName: user.displayName, email: user.email, isAdmin: false, avatarUrl: null } as SessionUser;
	const ws = await createWorkspace(su, { name: 'CloseAcme', slug: 'close-acme-smoke' });
	const project = await createProject(su, ws, { name: 'CloseProj' });
	const [board] = await listBoards(project.id);

	try {
		console.log('\n[4] enqueueIssueCloseForTicket captures issue coords BEFORE delete');
		// Linked project + a ticket that has a GitHub issue number.
		await db.update(schema.projects).set({ githubInstallationId: '7', githubRepo: repo }).where(eq(schema.projects.id, project.id));
		const [linked] = await db.insert(schema.tickets).values({ projectId: project.id, boardId: board.id, number: 1, title: 'Linked', position: 'a0', githubIssueNumber: 501 }).returning();
		await enqueueIssueCloseForTicket(linked.id);
		let jobs = await closeIssueJobs();
		assert(jobs.length === 1, 'one github:close-issue job enqueued');
		const p = jobs[0].payload as Record<string, unknown>;
		assert(p.installationId === '7' && p.repoFullName === repo && p.issueNumber === 501 && p.stateReason === 'not_planned', 'payload carries installation + repo + issue number + not_planned');

		console.log('\n[5] no job when the ticket has no linked issue');
		const [noIssue] = await db.insert(schema.tickets).values({ projectId: project.id, boardId: board.id, number: 2, title: 'No issue', position: 'a1' }).returning();
		await enqueueIssueCloseForTicket(noIssue.id);
		jobs = await closeIssueJobs();
		assert(jobs.length === 1, 'still just one job — a ticket with no githubIssueNumber enqueues nothing');

		console.log('\n[6] no job when the project is not linked to a repo');
		const project2 = await createProject(su, ws, { name: 'Unlinked' });
		const [b2] = await listBoards(project2.id);
		const [orphan] = await db.insert(schema.tickets).values({ projectId: project2.id, boardId: b2.id, number: 1, title: 'Orphan', position: 'a0', githubIssueNumber: 999 }).returning();
		await enqueueIssueCloseForTicket(orphan.id);
		jobs = await closeIssueJobs();
		assert(jobs.length === 1, 'unlinked project enqueues nothing');

		console.log('\n[smoke-github-close] ✓ all checks passed');
	} finally {
		// Remove the close-issue jobs we created so the app worker never acts on them.
		for (const j of await closeIssueJobs()) await db.delete(schema.jobs).where(eq(schema.jobs.id, j.id)).catch(() => {});
		await deleteWorkspace(ws.id).catch(() => {});
		await db.delete(schema.users).where(eq(schema.users.id, user.id)).catch(() => {});
	}
	await closeDb();
}

main().catch(async (e) => {
	console.error(e);
	await closeDb();
	process.exit(1);
});
