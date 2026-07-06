import '$lib/server/load-env';
import { and, asc, eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import { applyWebhookEvent } from '$lib/server/github/sync';
import { branchMatchesIssue, aggregateCheckStatus, checkSuiteStatus } from '$lib/server/github/map';
import { linkPr, unlinkPr } from '$lib/server/github/pr';
import type { OctokitLike } from '$lib/server/github/import';
import { createProject } from '$lib/server/services/projects';
import { listBoards } from '$lib/server/services/boards';
import { createWorkspace, deleteWorkspace } from '$lib/server/services/workspaces';
import type { SessionUser } from '$lib/server/auth/session';

function assert(c: unknown, m: string) {
	if (!c) throw new Error('FAIL: ' + m);
	console.log('  ✓ ' + m);
}

const repo = 'acme/pr';

// Fake Octokit for linkPr: serves one PR + its head-commit check-runs.
function fakeOctokit(prState = 'open', merged = false, runs: Array<{ status: string; conclusion: string | null }> = []): OctokitLike {
	return {
		async request(route: string, params?: Record<string, unknown>) {
			if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}') {
				return {
					data: {
						number: params?.pull_number,
						title: 'Manual PR',
						state: prState,
						merged,
						head: { ref: 'feature/manual', sha: 'shaMANUAL' },
						html_url: `https://github.com/${repo}/pull/${params?.pull_number}`
					}
				};
			}
			if (route === 'GET /repos/{owner}/{repo}/commits/{ref}/check-runs') {
				return { data: { check_runs: runs } };
			}
			throw new Error('unexpected route ' + route);
		}
	};
}

async function makeTicket(projectId: string, boardId: string, columnId: string, num: number, issue: number) {
	const [t] = await db
		.insert(schema.tickets)
		.values({ projectId, boardId, columnId, number: num, title: `Ticket ${num}`, position: 'a0', githubIssueNumber: issue })
		.returning();
	return t;
}

async function main() {
	console.log('[1] pure helpers');
	assert(branchMatchesIssue('123-fix-thing', 123), 'branch "123-fix-thing" matches 123');
	assert(branchMatchesIssue('feature/OT-123', 123), 'branch "feature/OT-123" matches 123');
	assert(branchMatchesIssue('fix/123_bug', 123), 'branch "fix/123_bug" matches 123');
	assert(!branchMatchesIssue('1234-x', 123), 'branch "1234-x" does NOT match 123 (distinct token)');
	assert(!branchMatchesIssue('main', 123), 'branch "main" does not match');
	assert(aggregateCheckStatus([]) === null, 'no runs → null');
	assert(aggregateCheckStatus([{ status: 'in_progress' }]) === 'pending', 'a running check → pending');
	assert(aggregateCheckStatus([{ status: 'completed', conclusion: 'success' }, { status: 'completed', conclusion: 'failure' }]) === 'failure', 'any failure → failure');
	assert(aggregateCheckStatus([{ status: 'completed', conclusion: 'success' }, { status: 'completed', conclusion: 'neutral' }]) === 'success', 'success + neutral → success');
	assert(checkSuiteStatus('in_progress', null) === 'pending', 'suite in_progress → pending');
	assert(checkSuiteStatus('completed', 'success') === 'success', 'suite completed/success → success');
	assert(checkSuiteStatus('completed', 'timed_out') === 'failure', 'suite timed_out → failure');
	assert(checkSuiteStatus('completed', 'cancelled') === 'neutral', 'suite cancelled → neutral');

	// ── DB fixtures ──
	const [user] = await db
		.insert(schema.users)
		.values({ username: 'pr-smoke', displayName: 'PR Smoke', email: 'pr@example.com' })
		.returning();
	const su: SessionUser = { id: user.id, username: user.username, displayName: user.displayName, email: user.email, isAdmin: false, avatarUrl: null } as SessionUser;
	const ws = await createWorkspace(su, { name: 'PRAcme', slug: 'pr-acme-smoke' });
	const project = await createProject(su, ws, { name: 'PRproj' });
	await db.update(schema.projects).set({ githubInstallationId: '1', githubRepo: repo }).where(eq(schema.projects.id, project.id));
	const [board] = await listBoards(project.id);
	const [col] = await db.select().from(schema.boardColumns).where(eq(schema.boardColumns.boardId, board.id)).orderBy(asc(schema.boardColumns.position)).limit(1);

	try {
		console.log('\n[2] branch-name auto-match links a PR that has no "#ref"');
		const t1 = await makeTicket(project.id, board.id, col.id, 1, 210);
		await applyWebhookEvent('pull_request', 'opened', {
			repository: { full_name: repo },
			pull_request: { number: 310, title: 'No refs here', body: 'nothing', state: 'open', merged: false, head: { ref: '210-fix-widget', sha: 'shaA1' } }
		});
		let [r1] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, t1.id));
		assert(r1.githubPrNumber === 310, 'PR linked via branch match');
		assert(r1.githubPrLinkSource === 'branch', 'link source = branch');
		assert(r1.githubPrHeadRef === '210-fix-widget' && r1.githubPrHeadSha === 'shaA1', 'head ref + sha stored');
		assert(r1.githubCiStatus === 'pending', 'first head commit → CI pending');

		console.log('\n[3] synchronize (new head sha) resets CI to pending');
		await db.update(schema.tickets).set({ githubCiStatus: 'success' }).where(eq(schema.tickets.id, t1.id));
		await applyWebhookEvent('pull_request', 'synchronize', {
			repository: { full_name: repo },
			pull_request: { number: 310, title: 'x', body: '', state: 'open', merged: false, head: { ref: '210-fix-widget', sha: 'shaA2' } }
		});
		[r1] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, t1.id));
		assert(r1.githubPrHeadSha === 'shaA2', 'head sha updated on synchronize');
		assert(r1.githubCiStatus === 'pending', 'CI reset to pending on new sha');

		console.log('\n[4] manual link is sticky — a different PR cannot steal it');
		const t2 = await makeTicket(project.id, board.id, col.id, 2, 220);
		await db.update(schema.tickets).set({ githubPrNumber: 999, githubPrState: 'open', githubPrLinkSource: 'manual' }).where(eq(schema.tickets.id, t2.id));
		await applyWebhookEvent('pull_request', 'opened', {
			repository: { full_name: repo },
			pull_request: { number: 888, title: 'closes #220', body: 'closes #220', state: 'open', merged: false, head: { ref: '220-x', sha: 'shaB' } }
		});
		let [r2] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, t2.id));
		assert(r2.githubPrNumber === 999, 'different PR did NOT replace the manual link');
		// Same PR number still updates state (merge).
		await applyWebhookEvent('pull_request', 'closed', {
			repository: { full_name: repo },
			pull_request: { number: 999, title: 'x', body: '', state: 'closed', merged: true, head: { ref: '220-x', sha: 'shaB2' } }
		});
		[r2] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, t2.id));
		assert(r2.githubPrNumber === 999 && r2.githubPrState === 'merged', 'same PR number updates state to merged');
		assert(r2.githubPrLinkSource === 'manual', 'link source stays manual');

		console.log('\n[5] check_suite sets aggregate CI by PR number');
		const t3 = await makeTicket(project.id, board.id, col.id, 3, 230);
		await applyWebhookEvent('pull_request', 'opened', {
			repository: { full_name: repo },
			pull_request: { number: 330, title: 'x', body: 'fixes #230', state: 'open', merged: false, head: { ref: 'feat/230', sha: 'shaC' } }
		});
		await applyWebhookEvent('check_suite', 'completed', {
			repository: { full_name: repo },
			check_suite: { status: 'completed', conclusion: 'success', head_sha: 'shaC', pull_requests: [{ number: 330 }] }
		});
		const [r3] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, t3.id));
		assert(r3.githubCiStatus === 'success', 'CI set to success by PR number');

		console.log('\n[6] check_suite head-SHA fallback when pull_requests[] is empty');
		const t4 = await makeTicket(project.id, board.id, col.id, 4, 240);
		await applyWebhookEvent('pull_request', 'opened', {
			repository: { full_name: repo },
			pull_request: { number: 340, title: 'fixes #240', body: 'fixes #240', state: 'open', merged: false, head: { ref: 'feat/240', sha: 'shaFED' } }
		});
		await applyWebhookEvent('check_suite', 'completed', {
			repository: { full_name: repo },
			check_suite: { status: 'completed', conclusion: 'failure', head_sha: 'shaFED', pull_requests: [] }
		});
		const [r4] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, t4.id));
		assert(r4.githubCiStatus === 'failure', 'CI set to failure via head-SHA fallback');

		console.log('\n[7] manual linkPr / unlinkPr via injected Octokit');
		const t5 = await makeTicket(project.id, board.id, col.id, 5, 250);
		const ok = await linkPr(t5.id, 555, fakeOctokit('open', false, [
			{ status: 'completed', conclusion: 'success' },
			{ status: 'completed', conclusion: 'success' }
		]));
		assert(ok, 'linkPr returned true');
		let [r5] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, t5.id));
		assert(r5.githubPrNumber === 555 && r5.githubPrLinkSource === 'manual', 'manual PR linked with source=manual');
		assert(r5.githubPrHeadSha === 'shaMANUAL' && r5.githubCiStatus === 'success', 'fetched head sha + aggregated CI = success');
		await unlinkPr(t5.id);
		[r5] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, t5.id));
		assert(
			r5.githubPrNumber === null && r5.githubPrState === null && r5.githubPrHeadRef === null && r5.githubPrHeadSha === null && r5.githubPrLinkSource === null && r5.githubCiStatus === null,
			'unlinkPr cleared all six PR/CI columns'
		);

		console.log('\n[smoke-github-pr] ✓ all checks passed');
	} finally {
		// Clean up the scratch workspace (cascades to project/board/tickets) + user.
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
