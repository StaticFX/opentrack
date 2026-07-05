import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { CLOSED_CATEGORIES } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import { boardEvent } from '$lib/server/realtime/board';
import { rankAfter } from '$lib/server/util/rank';
import { installationOctokit } from './app';
import { issueToTicketFields, parseRepo, ticketToIssue } from './map';

type Project = typeof schema.projects.$inferSelect;

// ── Column selection ───────────────────────────────────────────────────────
async function boardColumns(boardId: string) {
	return db
		.select()
		.from(schema.boardColumns)
		.where(eq(schema.boardColumns.boardId, boardId))
		.orderBy(asc(schema.boardColumns.position));
}
function pickClosedColumn(cols: Array<{ id: string; category: string }>) {
	return cols.find((c) => c.category === 'done') ?? cols.find((c) => c.category === 'canceled') ?? cols.at(-1);
}
function pickOpenColumn(cols: Array<{ id: string; category: string }>) {
	return (
		cols.find((c) => c.category === 'backlog') ??
		cols.find((c) => c.category === 'todo') ??
		cols.find((c) => !CLOSED_CATEGORIES.includes(c.category as never)) ??
		cols[0]
	);
}

async function firstBoard(projectId: string) {
	const [b] = await db
		.select()
		.from(schema.boards)
		.where(eq(schema.boards.projectId, projectId))
		.orderBy(asc(schema.boards.position))
		.limit(1);
	return b ?? null;
}

async function findLinkedProjects(repoFullName: string): Promise<Project[]> {
	return db.select().from(schema.projects).where(eq(schema.projects.githubRepo, repoFullName));
}

// ── Outbound: local → GitHub ────────────────────────────────────────────────
export async function pushTicket(ticketId: string): Promise<void> {
	const [row] = await db
		.select({ ticket: schema.tickets, project: schema.projects })
		.from(schema.tickets)
		.innerJoin(schema.projects, eq(schema.tickets.projectId, schema.projects.id))
		.where(eq(schema.tickets.id, ticketId))
		.limit(1);
	if (!row) return;
	const { ticket, project } = row;
	const repo = parseRepo(project.githubRepo);
	if (!repo || !project.githubInstallationId) return;

	let category = 'todo';
	let columnName: string | null = null;
	if (ticket.columnId) {
		const [c] = await db
			.select({ category: schema.boardColumns.category, name: schema.boardColumns.name })
			.from(schema.boardColumns)
			.where(eq(schema.boardColumns.id, ticket.columnId))
			.limit(1);
		category = c?.category ?? 'todo';
		columnName = c?.name ?? null;
	}
	const labelRows = await db
		.select({ name: schema.labels.name })
		.from(schema.ticketLabels)
		.innerJoin(schema.labels, eq(schema.ticketLabels.labelId, schema.labels.id))
		.where(eq(schema.ticketLabels.ticketId, ticketId));
	const labelNames = labelRows.map((l) => l.name);
	// Progress sync: mirror the board column as a "Status: <name>" issue label.
	const progress = (project.githubProgressLabels as string[] | null) ?? [];
	if (columnName && progress.includes(columnName)) labelNames.push(`Status: ${columnName}`);
	const payload = ticketToIssue(ticket, category, labelNames);
	const octokit = await installationOctokit(project.githubInstallationId);

	if (ticket.githubIssueNumber) {
		await octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
			...repo,
			issue_number: ticket.githubIssueNumber,
			title: payload.title,
			body: payload.body,
			state: payload.state,
			// state_reason is only valid alongside a state change; 'reopened' applies when opening.
			...(payload.stateReason ? { state_reason: payload.stateReason } : {}),
			labels: payload.labels
		});
		await db.update(schema.tickets).set({ githubSyncedAt: new Date() }).where(eq(schema.tickets.id, ticketId));
	} else {
		const res = await octokit.request('POST /repos/{owner}/{repo}/issues', {
			...repo,
			title: payload.title,
			body: payload.body,
			labels: payload.labels
		});
		await db
			.update(schema.tickets)
			.set({ githubIssueNumber: res.data.number, githubNodeId: res.data.node_id, githubSyncedAt: new Date() })
			.where(eq(schema.tickets.id, ticketId));
	}
}

export async function pushComment(commentId: string): Promise<void> {
	const [c] = await db.select().from(schema.comments).where(eq(schema.comments.id, commentId)).limit(1);
	if (!c || c.subjectType !== 'ticket' || c.githubCommentId) return;
	const [row] = await db
		.select({ ticket: schema.tickets, project: schema.projects })
		.from(schema.tickets)
		.innerJoin(schema.projects, eq(schema.tickets.projectId, schema.projects.id))
		.where(eq(schema.tickets.id, c.subjectId))
		.limit(1);
	if (!row) return;
	const repo = parseRepo(row.project.githubRepo);
	if (!repo || !row.project.githubInstallationId || !row.ticket.githubIssueNumber) return;

	const octokit = await installationOctokit(row.project.githubInstallationId);
	const res = await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
		...repo,
		issue_number: row.ticket.githubIssueNumber,
		body: c.body
	});
	await db.update(schema.comments).set({ githubCommentId: String(res.data.id) }).where(eq(schema.comments.id, commentId));
}

// ── Inbound: GitHub → local ─────────────────────────────────────────────────
async function upsertIssueTicket(project: Project, issue: Parameters<typeof issueToTicketFields>[0]) {
	const fields = issueToTicketFields(issue);
	const board = await firstBoard(project.id);
	if (!board) return;
	const cols = await boardColumns(board.id);
	if (cols.length === 0) return;

	const [existing] = await db
		.select()
		.from(schema.tickets)
		.where(and(eq(schema.tickets.projectId, project.id), eq(schema.tickets.githubIssueNumber, fields.githubIssueNumber)))
		.limit(1);

	if (existing) {
		const wasClosed = !!existing.closedAt;
		let columnId = existing.columnId;
		if (fields.closed && !wasClosed) columnId = pickClosedColumn(cols)?.id ?? columnId;
		else if (!fields.closed && wasClosed) columnId = pickOpenColumn(cols)?.id ?? columnId;
		await db
			.update(schema.tickets)
			.set({
				title: fields.title,
				description: fields.description,
				githubNodeId: fields.githubNodeId,
				columnId,
				closedAt: fields.closed ? (existing.closedAt ?? new Date()) : null,
				githubSyncedAt: new Date(),
				updatedAt: new Date()
			})
			.where(eq(schema.tickets.id, existing.id));
	} else {
		const col = fields.closed ? pickClosedColumn(cols) : pickOpenColumn(cols);
		if (!col) return;
		const [{ max }] = await db
			.select({ max: sql<number>`coalesce(max(${schema.tickets.number}), 0)` })
			.from(schema.tickets)
			.where(eq(schema.tickets.projectId, project.id));
		const [last] = await db
			.select({ position: schema.tickets.position })
			.from(schema.tickets)
			.where(and(eq(schema.tickets.boardId, board.id), eq(schema.tickets.columnId, col.id)))
			.orderBy(desc(schema.tickets.position))
			.limit(1);
		await db.insert(schema.tickets).values({
			projectId: project.id,
			boardId: board.id,
			columnId: col.id,
			number: Number(max) + 1,
			title: fields.title,
			description: fields.description,
			position: rankAfter(last?.position ?? null),
			githubIssueNumber: fields.githubIssueNumber,
			githubNodeId: fields.githubNodeId,
			closedAt: fields.closed ? new Date() : null,
			githubSyncedAt: new Date()
		});
	}
	await boardEvent(board.id, 'ticket.synced', { issue: fields.githubIssueNumber });
}

async function applyIssue(action: string, payload: any) {
	const repoFull = payload?.repository?.full_name;
	if (!repoFull || !payload?.issue) return;
	const projects = await findLinkedProjects(repoFull);

	for (const project of projects) {
		if (action === 'deleted') {
			await db
				.delete(schema.tickets)
				.where(and(eq(schema.tickets.projectId, project.id), eq(schema.tickets.githubIssueNumber, payload.issue.number)));
		} else {
			await upsertIssueTicket(project, payload.issue);
		}
	}
}

async function applyIssueComment(action: string, payload: any) {
	if (action !== 'created') return;
	const repoFull = payload?.repository?.full_name;
	const issueNumber = payload?.issue?.number;
	const gh = payload?.comment;
	if (!repoFull || !issueNumber || !gh) return;
	const projects = await findLinkedProjects(repoFull);

	for (const project of projects) {
		const [ticket] = await db
			.select({ id: schema.tickets.id })
			.from(schema.tickets)
			.where(and(eq(schema.tickets.projectId, project.id), eq(schema.tickets.githubIssueNumber, issueNumber)))
			.limit(1);
		if (!ticket) continue;
		// Skip if we already have this GitHub comment (echo of our own push).
		const [dupe] = await db
			.select({ id: schema.comments.id })
			.from(schema.comments)
			.where(eq(schema.comments.githubCommentId, String(gh.id)))
			.limit(1);
		if (dupe) continue;
		await db.insert(schema.comments).values({
			subjectType: 'ticket',
			subjectId: ticket.id,
			authorId: null,
			body: gh.body ?? '',
			githubCommentId: String(gh.id)
		});
	}
}

async function applyPullRequest(_action: string, payload: any) {
	// Link a PR to every ticket its title/body references via "#<issue>",
	// tracking the PR's state (open / closed / merged) for display.
	const repoFull = payload?.repository?.full_name;
	const pr = payload?.pull_request;
	if (!repoFull || !pr) return;
	const text = `${pr.title ?? ''} ${pr.body ?? ''}`;
	const issueNumbers = [...text.matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
	if (issueNumbers.length === 0) return;
	const prState = pr.merged ? 'merged' : pr.state === 'closed' ? 'closed' : 'open';
	const projects = await findLinkedProjects(repoFull);
	for (const project of projects) {
		await db
			.update(schema.tickets)
			.set({ githubPrNumber: pr.number, githubPrState: prState })
			.where(
				and(
					eq(schema.tickets.projectId, project.id),
					inArray(schema.tickets.githubIssueNumber, issueNumbers)
				)
			);
	}
}

async function applyRelease(action: string, payload: any) {
	const repoFull = payload?.repository?.full_name;
	const rel = payload?.release;
	if (!repoFull || !rel) return;
	const ghId = String(rel.id);
	const projects = await findLinkedProjects(repoFull);

	for (const project of projects) {
		if (action === 'deleted') {
			await db
				.delete(schema.releases)
				.where(and(eq(schema.releases.projectId, project.id), eq(schema.releases.githubReleaseId, ghId)));
			continue;
		}
		const values = {
			version: rel.tag_name ?? rel.name ?? 'untagged',
			name: (rel.name as string) ?? null,
			notes: (rel.body as string) ?? null,
			status: (rel.draft ? 'draft' : 'published') as 'draft' | 'published',
			releasedAt: rel.published_at ? new Date(rel.published_at) : null,
			githubReleaseId: ghId
		};
		const [existing] = await db
			.select({ id: schema.releases.id })
			.from(schema.releases)
			.where(and(eq(schema.releases.projectId, project.id), eq(schema.releases.githubReleaseId, ghId)))
			.limit(1);
		if (existing) {
			await db.update(schema.releases).set({ ...values, updatedAt: new Date() }).where(eq(schema.releases.id, existing.id));
		} else {
			const [row] = await db.insert(schema.releases).values({ projectId: project.id, ...values }).returning({ id: schema.releases.id });
			if (rel.html_url) {
				await db.insert(schema.releaseLinks).values({ releaseId: row.id, label: 'View on GitHub', url: rel.html_url, type: 'github' });
			}
		}
	}
}

/** Apply a stored webhook event to local state. */
export async function applyWebhookEvent(event: string, action: string | null, payload: any): Promise<void> {
	const act = action ?? '';
	switch (event) {
		case 'issues':
			return applyIssue(act, payload);
		case 'issue_comment':
			return applyIssueComment(act, payload);
		case 'pull_request':
			return applyPullRequest(act, payload);
		case 'release':
			return applyRelease(act, payload);
		case 'installation':
			if (act === 'deleted') {
				await db
					.delete(schema.githubInstallations)
					.where(eq(schema.githubInstallations.installationId, String(payload?.installation?.id)));
			}
			return;
		default:
			return; // release handled in M7; others ignored
	}
}
