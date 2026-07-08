import '$lib/server/load-env';
import { generateKeyPairSync } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import { categoryToState, issueToTicketFields, parseRepo, ticketToIssue } from '$lib/server/github/map';
import { signState, verifyState } from '$lib/server/github/state';
import { applyWebhookEvent } from '$lib/server/github/sync';
import { createProject } from '$lib/server/services/projects';
import { listBoards, getBoardColumns } from '$lib/server/services/boards';
import { createWorkspace } from '$lib/server/services/workspaces';
import type { SessionUser } from '$lib/server/auth/session';

// A valid RSA key so getApp() can construct (used by the signature test). The
// GitHub App config is DB-backed now, so we store it via setSetting in main().
const TEST_APP_PRIVATE_KEY = generateKeyPairSync('rsa', {
	modulusLength: 2048,
	privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
	publicKeyEncoding: { type: 'spki', format: 'pem' }
}).privateKey;

function assert(c: unknown, m: string) {
	if (!c) throw new Error('FAIL: ' + m);
	console.log('  ✓ ' + m);
}

const repo = 'acme/widgets';
function issuePayload(over: Record<string, unknown> = {}) {
	return {
		repository: { full_name: repo },
		issue: { number: 42, node_id: 'MDU6', title: 'From GitHub', body: 'hello', state: 'open', ...over }
	};
}

async function main() {
	console.log('[1] pure mapping');
	assert(categoryToState('done') === 'closed' && categoryToState('todo') === 'open', 'category → state');
	assert(parseRepo('a/b')?.owner === 'a' && parseRepo('bad') === null, 'parseRepo');
	assert(ticketToIssue({ title: 'T', description: null }, 'done', ['bug']).state === 'closed', 'ticketToIssue closed+labels');
	assert(issueToTicketFields(issuePayload().issue).githubIssueNumber === 42, 'issueToTicketFields');

	console.log('[2] signed state round-trip');
	const st = signState('workspace-123');
	assert(verifyState(st) === 'workspace-123', 'valid state verifies');
	assert(verifyState(st + 'x') === null, 'tampered state rejected');

	console.log('[3] webhook signature verification');
	const { setSetting, invalidateConfig } = await import('$lib/server/config');
	await setSetting('github.appId', '1');
	await setSetting('github.webhookSecret', 'test-webhook-secret', true);
	await setSetting('github.privateKey', TEST_APP_PRIVATE_KEY, true);
	invalidateConfig();
	const { getApp } = await import('$lib/server/github/app');
	const app = await getApp();
	const body = JSON.stringify(issuePayload());
	const sig = await app.webhooks.sign(body);
	assert(await app.webhooks.verify(body, sig), 'valid signature accepted');
	assert(!(await app.webhooks.verify(body, 'sha256=deadbeef')), 'bad signature rejected');

	console.log('[4] set up a linked project');
	const [u] = await db.insert(schema.users).values({ username: `gh-${Date.now()}`, displayName: 'GH' }).returning();
	const user: SessionUser = { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };
	const ws = await createWorkspace(user, { name: 'GH WS' });
	const project = await createProject(user, { ...ws }, { name: 'GH Proj' });
	await db.update(schema.projects).set({ githubRepo: repo, githubInstallationId: '999' }).where(eq(schema.projects.id, project.id));
	const [board] = await listBoards(project.id);
	const cols = await getBoardColumns(board.id);
	const doneCol = cols.find((c) => c.category === 'done')!;

	console.log('[5] inbound issues.opened → creates a ticket');
	await applyWebhookEvent('issues', 'opened', issuePayload());
	const [t1] = await db.select().from(schema.tickets).where(and(eq(schema.tickets.projectId, project.id), eq(schema.tickets.githubIssueNumber, 42)));
	assert(t1 && t1.title === 'From GitHub' && !t1.closedAt, 'ticket created, open, title mapped');

	console.log('[6] inbound issues.closed → moves to done + closedAt');
	await applyWebhookEvent('issues', 'closed', issuePayload({ state: 'closed' }));
	const [t2] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, t1.id));
	assert(t2.closedAt !== null && t2.columnId === doneCol.id, 'ticket closed + moved to done column');

	console.log('[7] inbound issues.reopened → clears closedAt');
	await applyWebhookEvent('issues', 'reopened', issuePayload({ state: 'open', title: 'Reopened title' }));
	const [t3] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, t1.id));
	assert(t3.closedAt === null && t3.title === 'Reopened title', 'reopened: closedAt cleared + title updated');

	console.log('[8] inbound issue_comment.created → adds comment (deduped)');
	const commentPayload = { repository: { full_name: repo }, issue: { number: 42 }, comment: { id: 5551, body: 'a GH comment' } };
	await applyWebhookEvent('issue_comment', 'created', commentPayload);
	await applyWebhookEvent('issue_comment', 'created', commentPayload); // replay
	const cs = await db.select().from(schema.comments).where(eq(schema.comments.subjectId, t1.id));
	assert(cs.length === 1 && cs[0].githubCommentId === '5551', 'comment added once (echo deduped)');

	console.log('[9] webhook event idempotency (unique delivery id)');
	const first = await db.insert(schema.githubWebhookEvents).values({ deliveryId: 'D1', event: 'issues', action: 'opened', payload: {} }).onConflictDoNothing().returning({ id: schema.githubWebhookEvents.id });
	const dupe = await db.insert(schema.githubWebhookEvents).values({ deliveryId: 'D1', event: 'issues', action: 'opened', payload: {} }).onConflictDoNothing().returning({ id: schema.githubWebhookEvents.id });
	assert(first.length === 1 && dupe.length === 0, 'duplicate delivery id ignored');

	// cleanup
	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	await db.delete(schema.users).where(eq(schema.users.id, u.id));
	await db.delete(schema.githubWebhookEvents);
	console.log('\n[smoke-github] ✓ all checks passed');
	await closeDb();
}

main().catch((e) => {
	console.error('\n[smoke-github] FAILED:', e);
	process.exit(1);
});
