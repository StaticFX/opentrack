import '$lib/server/load-env';
import { and, asc, eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import { importRepo, type OctokitLike } from '$lib/server/github/import';
import { listBoards, getBoardColumns } from '$lib/server/services/boards';
import { createProject } from '$lib/server/services/projects';
import { createWorkspace } from '$lib/server/services/workspaces';
import type { SessionUser } from '$lib/server/auth/session';

function assert(c: unknown, m: string) {
	if (!c) throw new Error('FAIL: ' + m);
	console.log('  ✓ ' + m);
}

const REPO = 'acme/widgets';

// A fake Octokit that serves canned repo/labels/issues (two pages of issues to
// exercise the manual pagination loop).
function fakeOctokit(): OctokitLike {
	const labels = [
		{ name: 'bug', color: 'd73a4a', description: 'Something broken' },
		{ name: 'enhancement', color: '#a2eeef', description: null }
	];
	const page1 = Array.from({ length: 100 }, (_, i) => ({
		number: i + 1,
		node_id: `N${i + 1}`,
		title: `Issue ${i + 1}`,
		body: `body ${i + 1}`,
		state: i % 2 === 0 ? 'open' : 'closed',
		labels: i === 0 ? [{ name: 'bug' }, { name: 'enhancement' }] : []
	}));
	const page2 = [
		{ number: 101, title: 'Last issue', body: null, state: 'open', labels: [{ name: 'bug' }] },
		// A pull request masquerading in the issues list — must be skipped.
		{ number: 102, title: 'A PR', body: '', state: 'open', pull_request: { url: 'x' }, labels: [] }
	];
	return {
		async request(route: string, params: Record<string, unknown> = {}) {
			if (route === 'GET /repos/{owner}/{repo}/labels') {
				return { data: (params.page ?? 1) === 1 ? labels : [] };
			}
			if (route === 'GET /repos/{owner}/{repo}/issues') {
				const page = Number(params.page ?? 1);
				return { data: page === 1 ? page1 : page === 2 ? page2 : [] };
			}
			throw new Error('unexpected route ' + route);
		}
	};
}

async function main() {
	const [u] = await db
		.insert(schema.users)
		.values({ username: `imp-${Date.now()}`, displayName: 'Importer' })
		.returning();
	const user: SessionUser = { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };
	const ws = await createWorkspace(user, { name: 'Import WS' });
	const project = await createProject(user, { ...ws }, { name: 'widgets' });
	await db.update(schema.projects).set({ githubRepo: REPO, githubInstallationId: '999' }).where(eq(schema.projects.id, project.id));

	const [board] = await listBoards(project.id);
	const cols = await getBoardColumns(board.id);
	const doneCol = cols.find((c) => c.category === 'done')!;
	const backlogCol = cols.find((c) => c.category === 'backlog')!;

	console.log('[1] import labels + issues');
	const res = await importRepo({ projectId: project.id, installationId: '999', repoFullName: REPO }, fakeOctokit());
	assert(res.labels === 2, `created 2 labels (got ${res.labels})`);
	// 101 real issues (1..101); the PR (#102) is skipped.
	assert(res.issues === 101, `imported 101 issues, PR skipped (got ${res.issues})`);

	console.log('[2] labels persisted with # colors + descriptions');
	const labels = await db.select().from(schema.labels).where(eq(schema.labels.projectId, project.id));
	const bug = labels.find((l) => l.name === 'bug')!;
	const enh = labels.find((l) => l.name === 'enhancement')!;
	assert(bug.color === '#d73a4a' && bug.description === 'Something broken', 'bug label color/desc');
	assert(enh.color === '#a2eeef', 'enhancement color normalized (no double #)');

	console.log('[3] tickets created with sequential numbers + github issue numbers');
	const tickets = await db.select().from(schema.tickets).where(eq(schema.tickets.projectId, project.id));
	assert(tickets.length === 101, `101 tickets (got ${tickets.length})`);
	const byIssue = new Map(tickets.map((t) => [t.githubIssueNumber, t]));
	assert(byIssue.has(1) && byIssue.has(101) && !byIssue.has(102), 'issue #1 & #101 present, PR #102 absent');
	const nums = tickets.map((t) => t.number).sort((a, b) => a - b);
	assert(nums[0] === 1 && nums[nums.length - 1] === 101 && new Set(nums).size === 101, 'ticket numbers 1..101 unique');

	console.log('[4] open/closed routed to the right columns');
	const issue1 = byIssue.get(1)!; // open
	const issue2 = byIssue.get(2)!; // closed
	assert(issue1.columnId === backlogCol.id && issue1.closedAt === null, 'open issue → backlog, not closed');
	assert(issue2.columnId === doneCol.id && issue2.closedAt !== null, 'closed issue → done + closedAt set');

	console.log('[5] issue labels attached');
	const t1Labels = await db.select().from(schema.ticketLabels).where(eq(schema.ticketLabels.ticketId, issue1.id));
	assert(t1Labels.length === 2, 'issue #1 has 2 labels attached');

	console.log('[6] positions are distinct within a column');
	const backlog = tickets.filter((t) => t.columnId === backlogCol.id).map((t) => t.position);
	assert(new Set(backlog).size === backlog.length, 'no duplicate positions in backlog');

	console.log('[7] re-import is idempotent (no dupes)');
	const res2 = await importRepo({ projectId: project.id, installationId: '999', repoFullName: REPO }, fakeOctokit());
	assert(res2.labels === 0 && res2.issues === 0, 're-import adds nothing');
	const after = await db.select().from(schema.tickets).where(eq(schema.tickets.projectId, project.id));
	assert(after.length === 101, 'still 101 tickets after re-import');

	// Cleanup
	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	await db.delete(schema.users).where(eq(schema.users.id, u.id));
	console.log('\nAll import smoke checks passed ✓');
}

main()
	.then(() => closeDb())
	.catch(async (e) => {
		console.error(e);
		await closeDb();
		process.exit(1);
	});
