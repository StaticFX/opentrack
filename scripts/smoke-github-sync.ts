import '$lib/server/load-env';
import { and, eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import { applyWebhookEvent } from '$lib/server/github/sync';
import { createProject } from '$lib/server/services/projects';
import { listBoards, getBoardColumns } from '$lib/server/services/boards';
import { createWorkspace } from '$lib/server/services/workspaces';
import type { SessionUser } from '$lib/server/auth/session';

function assert(c: unknown, m: string) {
	if (!c) throw new Error('FAIL: ' + m);
	console.log('  ✓ ' + m);
}

const repo = 'acme/sync';

async function main() {
	// A user with a linked GitHub account (login "octo").
	const [user] = await db
		.insert(schema.users)
		.values({ username: 'octo-ot', displayName: 'Octo Cat', email: 'octo@example.com' })
		.returning();
	await db.insert(schema.oauthAccounts).values({
		userId: user.id,
		provider: 'github',
		providerUserId: '9999',
		providerUsername: 'octo',
		avatarUrl: 'https://avatars.example/octo.png'
	});
	const su: SessionUser = { id: user.id, username: user.username, displayName: user.displayName, email: user.email, isAdmin: false, avatarUrl: null } as SessionUser;

	const ws = await createWorkspace(su, { name: 'Acme', slug: 'acme-sync' });
	const project = await createProject(su, ws, { name: 'Sync' });
	await db
		.update(schema.projects)
		.set({ githubInstallationId: '1', githubRepo: repo })
		.where(eq(schema.projects.id, project.id));
	const [board] = await listBoards(project.id);
	await getBoardColumns(board.id);

	console.log('[1] milestone webhook creates a local milestone');
	await applyWebhookEvent('milestone', 'created', {
		repository: { full_name: repo },
		milestone: { number: 3, id: 555, title: 'v1.0', description: 'first', state: 'open', due_on: '2026-09-01T00:00:00Z' }
	});
	const [ms] = await db
		.select()
		.from(schema.milestones)
		.where(and(eq(schema.milestones.projectId, project.id), eq(schema.milestones.githubMilestoneNumber, 3)));
	assert(ms && ms.title === 'v1.0' && ms.state === 'open', 'milestone created from webhook');

	console.log('[2] issues.opened with assignee + priority label + milestone + label');
	await applyWebhookEvent('issues', 'opened', {
		repository: { full_name: repo },
		issue: {
			number: 100,
			node_id: 'I_100',
			title: 'Big feature',
			body: 'body',
			state: 'open',
			labels: [{ name: 'bug' }, { name: 'priority: high' }],
			assignees: [{ login: 'octo', id: 9999, avatar_url: 'https://avatars.example/octo.png' }, { login: 'ghost', id: 12, avatar_url: 'https://a/ghost.png' }],
			milestone: { number: 3, id: 555, title: 'v1.0', state: 'open' }
		}
	});
	const [ticket] = await db
		.select()
		.from(schema.tickets)
		.where(and(eq(schema.tickets.projectId, project.id), eq(schema.tickets.githubIssueNumber, 100)));
	assert(ticket, 'ticket created from issue');
	assert(ticket.priority === 'high', 'priority parsed from "priority: high" label → high');
	assert(ticket.milestoneId === ms.id, 'ticket linked to milestone');
	const snap = ticket.githubAssignees as Array<{ login: string }> | null;
	assert(snap && snap.length === 2 && snap.some((s) => s.login === 'ghost'), 'github assignee snapshot stored (incl. unlinked "ghost")');

	// The linked user "octo" is an OpenTrack assignee; "ghost" is not (no account).
	const assignees = await db
		.select({ userId: schema.ticketAssignees.userId })
		.from(schema.ticketAssignees)
		.where(eq(schema.ticketAssignees.ticketId, ticket.id));
	assert(assignees.length === 1 && assignees[0].userId === user.id, 'linked GitHub assignee resolved to OpenTrack user');

	// Labels: "bug" attached, "priority: high" NOT a plain label.
	const labelRows = await db
		.select({ name: schema.labels.name })
		.from(schema.ticketLabels)
		.innerJoin(schema.labels, eq(schema.ticketLabels.labelId, schema.labels.id))
		.where(eq(schema.ticketLabels.ticketId, ticket.id));
	const names = labelRows.map((l) => l.name);
	assert(names.includes('bug') && !names.some((n) => n.startsWith('priority:')), 'non-priority label attached; priority label excluded');

	console.log('[3] issues.edited removes an assignee + downgrades priority + clears milestone');
	await applyWebhookEvent('issues', 'edited', {
		repository: { full_name: repo },
		issue: {
			number: 100,
			node_id: 'I_100',
			title: 'Big feature',
			body: 'body',
			state: 'open',
			labels: [{ name: 'priority: low' }],
			assignees: [],
			milestone: null
		}
	});
	const [t2] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id));
	assert(t2.priority === 'low', 'priority downgraded to low');
	assert(t2.milestoneId === null, 'milestone cleared');
	const a2 = await db.select().from(schema.ticketAssignees).where(eq(schema.ticketAssignees.ticketId, ticket.id));
	assert(a2.length === 0, 'assignees reconciled to empty');
	const l2 = await db.select().from(schema.ticketLabels).where(eq(schema.ticketLabels.ticketId, ticket.id));
	assert(l2.length === 0, 'plain labels reconciled to empty (only priority label present)');

	console.log('[4] milestone webhook edited updates the local milestone');
	await applyWebhookEvent('milestone', 'edited', {
		repository: { full_name: repo },
		milestone: { number: 3, id: 555, title: 'v1.0.1', description: 'patched', state: 'closed' }
	});
	const [ms2] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, ms.id));
	assert(ms2.title === 'v1.0.1' && ms2.state === 'closed', 'milestone updated + closed from webhook');

	console.log('\n[smoke-github-sync] ✓ all checks passed');
	await closeDb();
}

main().catch(async (e) => {
	console.error(e);
	await closeDb();
	process.exit(1);
});
