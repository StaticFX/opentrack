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
	const releases = [
		{ id: 5001, tag_name: 'v1.0.0', name: 'First', body: 'notes', draft: false, published_at: '2024-01-01T00:00:00Z', html_url: 'https://github.com/acme/widgets/releases/tag/v1.0.0' },
		{ id: 5002, tag_name: 'v1.1.0', name: null, body: null, draft: true, published_at: null, html_url: 'https://github.com/acme/widgets/releases/tag/v1.1.0' }
	];
	const pulls = [
		{ number: 200, title: 'Fix bug', body: 'Closes #1', state: 'closed', merged_at: '2024-02-01T00:00:00Z' },
		{ number: 201, title: 'Unrelated', body: 'no refs', state: 'open', merged_at: null }
	];
	const createdLabels: string[] = [];
	return {
		created: createdLabels,
		async request(route: string, params: Record<string, unknown> = {}) {
			if (route === 'GET /repos/{owner}/{repo}/labels') {
				return { data: (params.page ?? 1) === 1 ? labels : [] };
			}
			if (route === 'GET /repos/{owner}/{repo}/issues') {
				const page = Number(params.page ?? 1);
				return { data: page === 1 ? page1 : page === 2 ? page2 : [] };
			}
			if (route === 'GET /repos/{owner}/{repo}/releases') {
				return { data: (params.page ?? 1) === 1 ? releases : [] };
			}
			if (route === 'GET /repos/{owner}/{repo}/pulls') {
				return { data: (params.page ?? 1) === 1 ? pulls : [] };
			}
			if (route === 'POST /repos/{owner}/{repo}/labels') {
				createdLabels.push(String(params.name));
				return { data: {} };
			}
			throw new Error('unexpected route ' + route);
		}
	} as OctokitLike & { created: string[] };
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

	console.log('[7] releases imported with status + GitHub link');
	assert(res.releases === 2, `imported 2 releases (got ${res.releases})`);
	const rels = await db.select().from(schema.releases).where(eq(schema.releases.projectId, project.id));
	const v1 = rels.find((r) => r.version === 'v1.0.0')!;
	const v11 = rels.find((r) => r.version === 'v1.1.0')!;
	assert(v1.status === 'published' && v1.releasedAt !== null && v1.githubReleaseId === '5001', 'v1.0.0 published + released + gh id');
	assert(v11.status === 'draft', 'v1.1.0 is a draft');
	const relLinks = await db.select().from(schema.releaseLinks).where(eq(schema.releaseLinks.releaseId, v1.id));
	assert(relLinks.length === 1 && relLinks[0].type === 'github', 'v1.0.0 has a View-on-GitHub link');

	console.log('[8] PRs linked to referenced tickets (default importPrs)');
	assert(res.prs === 1, `1 PR linked (got ${res.prs})`);
	const t1 = await db.select().from(schema.tickets).where(eq(schema.tickets.id, issue1.id));
	assert(t1[0].githubPrNumber === 200 && t1[0].githubPrState === 'merged', 'issue #1 linked to merged PR #200');

	console.log('[9] re-import is idempotent (no dupes)');
	const res2 = await importRepo({ projectId: project.id, installationId: '999', repoFullName: REPO }, fakeOctokit());
	assert(res2.labels === 0 && res2.issues === 0 && res2.releases === 0, 're-import adds nothing');
	const after = await db.select().from(schema.tickets).where(eq(schema.tickets.projectId, project.id));
	assert(after.length === 101, 'still 101 tickets after re-import');
	const relsAfter = await db.select().from(schema.releases).where(eq(schema.releases.projectId, project.id));
	assert(relsAfter.length === 2, 'still 2 releases after re-import');

	console.log('[10] options: label subset + progress labels + no releases');
	const proj2 = await createProject(user, { ...ws }, { name: 'widgets2' });
	await db.update(schema.projects).set({ githubRepo: REPO, githubInstallationId: '999' }).where(eq(schema.projects.id, proj2.id));
	const oct2 = fakeOctokit() as OctokitLike & { created: string[] };
	const res3 = await importRepo(
		{
			projectId: proj2.id,
			installationId: '999',
			repoFullName: REPO,
			options: { importIssues: true, importPrs: false, importReleases: false, issueLabels: ['bug'], progressColumns: ['In Progress', 'Done'] }
		},
		oct2
	);
	assert(res3.labels === 1, `only 'bug' label imported (got ${res3.labels})`);
	assert(res3.releases === 0, 'releases skipped when importReleases=false');
	assert(res3.prs === 0, 'PRs skipped when importPrs=false');
	assert(res3.progressLabels === 2, `2 progress labels created (got ${res3.progressLabels})`);
	assert(oct2.created.includes('Status: In Progress') && oct2.created.includes('Status: Done'), 'created Status: labels on GitHub');
	const p2Labels = await db.select().from(schema.labels).where(eq(schema.labels.projectId, proj2.id));
	assert(p2Labels.length === 1 && p2Labels[0].name === 'bug', "project2 has only the 'bug' label");
	// issue #1 references bug+enhancement, but only bug was imported → 1 attached
	const t1p2 = (await db.select().from(schema.tickets).where(eq(schema.tickets.projectId, proj2.id))).find((t) => t.githubIssueNumber === 1)!;
	const t1p2Labels = await db.select().from(schema.ticketLabels).where(eq(schema.ticketLabels.ticketId, t1p2.id));
	assert(t1p2Labels.length === 1, 'issue #1 has only the imported label attached');

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
