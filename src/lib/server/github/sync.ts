import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { CLOSED_CATEGORIES } from '$lib/constants';
import { priorityLabelName } from '$lib/github-labels';
import { db, schema } from '$lib/server/db';
import { boardEvent } from '$lib/server/realtime/board';
import { rankAfter } from '$lib/server/util/rank';
import { installationOctokit } from './app';
import { githubLoginsForUsers, resolveGithubUsers } from './identity';
import {
	branchMatchesIssue,
	checkSuiteStatus,
	type GhMilestoneRef,
	issueToTicketFields,
	parseRepo,
	ticketToIssue
} from './map';

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

// ── Reconciliation helpers (GitHub is the source of truth) ──────────────────

/** Make a ticket's labels exactly `names`, creating any missing project labels. */
async function reconcileTicketLabels(projectId: string, ticketId: string, names: string[]): Promise<void> {
	const wanted = [...new Set(names)];
	const existing = await db
		.select({ id: schema.labels.id, name: schema.labels.name })
		.from(schema.labels)
		.where(eq(schema.labels.projectId, projectId));
	const idByName = new Map(existing.map((l) => [l.name, l.id]));
	for (const name of wanted) {
		if (idByName.has(name)) continue;
		const [row] = await db
			.insert(schema.labels)
			.values({ projectId, name })
			.onConflictDoNothing()
			.returning({ id: schema.labels.id });
		if (row) idByName.set(name, row.id);
		else {
			// Raced with a concurrent insert — read it back.
			const [again] = await db
				.select({ id: schema.labels.id })
				.from(schema.labels)
				.where(and(eq(schema.labels.projectId, projectId), eq(schema.labels.name, name)))
				.limit(1);
			if (again) idByName.set(name, again.id);
		}
	}
	const wantedIds = new Set(wanted.map((n) => idByName.get(n)).filter((v): v is string => !!v));
	const current = await db
		.select({ labelId: schema.ticketLabels.labelId })
		.from(schema.ticketLabels)
		.where(eq(schema.ticketLabels.ticketId, ticketId));
	const currentIds = new Set(current.map((c) => c.labelId));
	for (const id of wantedIds) {
		if (!currentIds.has(id)) {
			await db.insert(schema.ticketLabels).values({ ticketId, labelId: id }).onConflictDoNothing();
		}
	}
	const toRemove = [...currentIds].filter((id) => !wantedIds.has(id));
	if (toRemove.length) {
		await db
			.delete(schema.ticketLabels)
			.where(and(eq(schema.ticketLabels.ticketId, ticketId), inArray(schema.ticketLabels.labelId, toRemove)));
	}
}

/** Make a ticket's OpenTrack assignees exactly `userIds`. */
async function reconcileTicketAssignees(ticketId: string, userIds: string[]): Promise<void> {
	const wanted = new Set(userIds);
	const current = await db
		.select({ userId: schema.ticketAssignees.userId })
		.from(schema.ticketAssignees)
		.where(eq(schema.ticketAssignees.ticketId, ticketId));
	const currentIds = new Set(current.map((c) => c.userId));
	for (const id of wanted) {
		if (!currentIds.has(id)) {
			await db.insert(schema.ticketAssignees).values({ ticketId, userId: id }).onConflictDoNothing();
		}
	}
	const toRemove = [...currentIds].filter((id) => !wanted.has(id));
	if (toRemove.length) {
		await db
			.delete(schema.ticketAssignees)
			.where(and(eq(schema.ticketAssignees.ticketId, ticketId), inArray(schema.ticketAssignees.userId, toRemove)));
	}
}

/** Upsert a local milestone from an inbound GitHub milestone ref; returns its id. */
export async function upsertMilestoneFromRef(projectId: string, ref: GhMilestoneRef): Promise<string> {
	const [existing] = await db
		.select({ id: schema.milestones.id })
		.from(schema.milestones)
		.where(
			and(
				eq(schema.milestones.projectId, projectId),
				eq(schema.milestones.githubMilestoneNumber, ref.number)
			)
		)
		.limit(1);
	const values = {
		title: ref.title,
		description: ref.description,
		state: ref.state,
		dueDate: ref.dueOn,
		githubMilestoneId: ref.githubMilestoneId,
		githubMilestoneNumber: ref.number,
		githubSyncedAt: new Date()
	};
	if (existing) {
		await db
			.update(schema.milestones)
			.set({ ...values, updatedAt: new Date() })
			.where(eq(schema.milestones.id, existing.id));
		return existing.id;
	}
	const [row] = await db
		.insert(schema.milestones)
		.values({ projectId, ...values })
		.returning({ id: schema.milestones.id });
	return row.id;
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
	// Priority sync: mirror the ticket priority as a "priority: <level>" label.
	if (project.githubSyncPriority) {
		const pl = priorityLabelName(ticket.priority);
		if (pl) labelNames.push(pl);
	}
	const payload = ticketToIssue(ticket, category, labelNames);

	// Assignee sync: push the GitHub logins of assignees with a linked account.
	let assignees: string[] | undefined;
	if (project.githubSyncAssignees) {
		const rows = await db
			.select({ userId: schema.ticketAssignees.userId })
			.from(schema.ticketAssignees)
			.where(eq(schema.ticketAssignees.ticketId, ticketId));
		const loginMap = await githubLoginsForUsers(rows.map((r) => r.userId));
		assignees = [...loginMap.values()];
	}

	// Milestone sync: send the linked milestone's GitHub number (null clears it).
	let milestone: number | null | undefined;
	if (project.githubSyncMilestones) {
		if (ticket.milestoneId) {
			const [m] = await db
				.select({ number: schema.milestones.githubMilestoneNumber })
				.from(schema.milestones)
				.where(eq(schema.milestones.id, ticket.milestoneId))
				.limit(1);
			milestone = m?.number ?? undefined; // unpushed milestone → leave issue untouched
		} else {
			milestone = null; // explicitly cleared
		}
	}

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
			labels: payload.labels,
			...(assignees !== undefined ? { assignees } : {}),
			...(milestone !== undefined ? { milestone } : {})
		});
		await db.update(schema.tickets).set({ githubSyncedAt: new Date() }).where(eq(schema.tickets.id, ticketId));
	} else {
		const res = await octokit.request('POST /repos/{owner}/{repo}/issues', {
			...repo,
			title: payload.title,
			body: payload.body,
			labels: payload.labels,
			...(assignees !== undefined ? { assignees } : {}),
			...(milestone != null ? { milestone } : {})
		});
		await db
			.update(schema.tickets)
			.set({ githubIssueNumber: res.data.number, githubNodeId: res.data.node_id, githubSyncedAt: new Date() })
			.where(eq(schema.tickets.id, ticketId));
	}
}

/** Push a local milestone to GitHub — create it or PATCH the existing one. */
export async function pushMilestone(milestoneId: string): Promise<void> {
	const [row] = await db
		.select({ milestone: schema.milestones, project: schema.projects })
		.from(schema.milestones)
		.innerJoin(schema.projects, eq(schema.milestones.projectId, schema.projects.id))
		.where(eq(schema.milestones.id, milestoneId))
		.limit(1);
	if (!row) return;
	const { milestone, project } = row;
	const repo = parseRepo(project.githubRepo);
	if (!repo || !project.githubInstallationId || !project.githubSyncMilestones) return;

	const octokit = await installationOctokit(project.githubInstallationId);
	const body = {
		title: milestone.title,
		state: milestone.state,
		description: milestone.description ?? '',
		...(milestone.dueDate ? { due_on: milestone.dueDate.toISOString() } : {})
	};

	if (milestone.githubMilestoneNumber) {
		await octokit.request('PATCH /repos/{owner}/{repo}/milestones/{milestone_number}', {
			...repo,
			milestone_number: milestone.githubMilestoneNumber,
			...body
		});
		await db
			.update(schema.milestones)
			.set({ githubSyncedAt: new Date() })
			.where(eq(schema.milestones.id, milestoneId));
	} else {
		const res = await octokit.request('POST /repos/{owner}/{repo}/milestones', { ...repo, ...body });
		await db
			.update(schema.milestones)
			.set({
				githubMilestoneNumber: (res.data as { number: number }).number,
				githubMilestoneId: String((res.data as { id: number }).id),
				githubSyncedAt: new Date()
			})
			.where(eq(schema.milestones.id, milestoneId));
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

	// Resolve the linked milestone (creating a local mirror on demand).
	let milestoneId: string | null = null;
	if (project.githubSyncMilestones && fields.milestone) {
		milestoneId = await upsertMilestoneFromRef(project.id, fields.milestone);
	}
	const snapshot = project.githubSyncAssignees ? fields.assignees : undefined;

	let ticketId: string;
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
				...(project.githubSyncPriority ? { priority: fields.priority } : {}),
				...(project.githubSyncMilestones ? { milestoneId } : {}),
				...(snapshot !== undefined ? { githubAssignees: snapshot } : {}),
				closedAt: fields.closed ? (existing.closedAt ?? new Date()) : null,
				githubSyncedAt: new Date(),
				updatedAt: new Date()
			})
			.where(eq(schema.tickets.id, existing.id));
		ticketId = existing.id;
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
		const [row] = await db
			.insert(schema.tickets)
			.values({
				projectId: project.id,
				boardId: board.id,
				columnId: col.id,
				milestoneId: project.githubSyncMilestones ? milestoneId : null,
				number: Number(max) + 1,
				title: fields.title,
				description: fields.description,
				priority: project.githubSyncPriority ? fields.priority : 'none',
				position: rankAfter(last?.position ?? null),
				githubIssueNumber: fields.githubIssueNumber,
				githubNodeId: fields.githubNodeId,
				githubAssignees: snapshot ?? null,
				closedAt: fields.closed ? new Date() : null,
				githubSyncedAt: new Date()
			})
			.returning({ id: schema.tickets.id });
		ticketId = row.id;
	}

	// Labels: reconcile the ticket's labels to the issue's (non-priority) labels.
	if (project.githubSyncLabels) {
		await reconcileTicketLabels(project.id, ticketId, fields.labels);
	}
	// Assignees: resolve GitHub logins → linked OpenTrack users and reconcile.
	if (project.githubSyncAssignees) {
		const resolved = await resolveGithubUsers(fields.assignees.map((a) => a.login));
		await reconcileTicketAssignees(ticketId, [...resolved.values()].map((u) => u.userId));
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
	// Link a PR to a ticket via either a "#<issue>" ref in its title/body OR a
	// branch name that contains the issue number (e.g. `123-fix`). Tracks the
	// PR's state (open / closed / merged) + head branch/SHA for display and CI.
	const repoFull = payload?.repository?.full_name;
	const pr = payload?.pull_request;
	if (!repoFull || !pr || typeof pr.number !== 'number') return;

	const branch: string | null = pr.head?.ref ?? null;
	const headSha: string | null = pr.head?.sha ?? null;
	const prState = pr.merged ? 'merged' : pr.state === 'closed' ? 'closed' : 'open';

	// Candidate issue numbers: "#<n>" refs ∪ numeric tokens in the branch. This is
	// only a cheap SQL prefilter — per-ticket matching uses branchMatchesIssue below.
	const text = `${pr.title ?? ''} ${pr.body ?? ''}`;
	const refNumbers = [...text.matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
	const branchNumbers = branch
		? [...new Set(branch.split(/\D+/).filter(Boolean).map(Number))]
		: [];
	const candidateNumbers = [...new Set([...refNumbers, ...branchNumbers])];
	if (candidateNumbers.length === 0) return;

	const projects = await findLinkedProjects(repoFull);
	for (const project of projects) {
		const tickets = await db
			.select({
				id: schema.tickets.id,
				issueNumber: schema.tickets.githubIssueNumber,
				curPr: schema.tickets.githubPrNumber,
				curSha: schema.tickets.githubPrHeadSha,
				curSource: schema.tickets.githubPrLinkSource
			})
			.from(schema.tickets)
			.where(
				and(
					eq(schema.tickets.projectId, project.id),
					inArray(schema.tickets.githubIssueNumber, candidateNumbers)
				)
			);

		for (const t of tickets) {
			const n = t.issueNumber as number;
			const viaRef = refNumbers.includes(n);
			const viaBranch = branchMatchesIssue(branch, n);
			if (!viaRef && !viaBranch) continue;

			// A manually-linked PR is sticky: a different PR can't steal the slot.
			if (t.curSource === 'manual' && t.curPr !== pr.number) continue;

			const source =
				t.curSource === 'manual' && t.curPr === pr.number ? 'manual' : viaRef ? 'ref' : 'branch';

			const set: Record<string, unknown> = {
				githubPrNumber: pr.number,
				githubPrState: prState,
				githubPrHeadRef: branch,
				githubPrHeadSha: headSha,
				githubPrLinkSource: source
			};
			// New head commit (first open or a `synchronize` push) → CI unknown
			// until the next check_suite lands.
			if (headSha != null && headSha !== t.curSha) {
				set.githubCiStatus = 'pending';
				set.githubCiUpdatedAt = new Date();
			}
			await db.update(schema.tickets).set(set).where(eq(schema.tickets.id, t.id));
		}
	}
}

async function applyCheckSuite(_action: string, payload: any) {
	// Aggregate CI status for a PR's head commit → the ticket(s) linked to that PR.
	const repoFull = payload?.repository?.full_name;
	const suite = payload?.check_suite;
	if (!repoFull || !suite) return;
	const status = checkSuiteStatus(suite.status, suite.conclusion);
	if (status == null) return;

	const prNumbers: number[] = Array.isArray(suite.pull_requests)
		? suite.pull_requests.map((p: any) => p?.number).filter((x: any): x is number => typeof x === 'number')
		: [];
	const headSha: string | null = suite.head_sha ?? null;
	const projects = await findLinkedProjects(repoFull);
	const now = new Date();

	for (const project of projects) {
		if (prNumbers.length > 0) {
			// Primary: the suite names its PR(s) directly.
			await db
				.update(schema.tickets)
				.set({ githubCiStatus: status, githubCiUpdatedAt: now })
				.where(
					and(
						eq(schema.tickets.projectId, project.id),
						inArray(schema.tickets.githubPrNumber, prNumbers)
					)
				);
		} else if (headSha) {
			// Fallback: fork PRs carry no pull_requests[]; match the stored head SHA.
			await db
				.update(schema.tickets)
				.set({ githubCiStatus: status, githubCiUpdatedAt: now })
				.where(
					and(
						eq(schema.tickets.projectId, project.id),
						eq(schema.tickets.githubPrHeadSha, headSha)
					)
				);
		}
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

async function applyMilestone(action: string, payload: any) {
	const repoFull = payload?.repository?.full_name;
	const m = payload?.milestone;
	if (!repoFull || !m || typeof m.number !== 'number') return;
	const projects = await findLinkedProjects(repoFull);

	for (const project of projects) {
		if (!project.githubSyncMilestones) continue;
		if (action === 'deleted') {
			// FK on tickets.milestoneId is ON DELETE SET NULL, so tickets detach.
			await db
				.delete(schema.milestones)
				.where(
					and(
						eq(schema.milestones.projectId, project.id),
						eq(schema.milestones.githubMilestoneNumber, m.number)
					)
				);
			continue;
		}
		const ref: GhMilestoneRef = {
			number: m.number,
			githubMilestoneId: m.id != null ? String(m.id) : null,
			title: m.title ?? 'Untitled',
			description: m.description ?? null,
			state: m.state === 'closed' ? 'closed' : 'open',
			dueOn: m.due_on ? new Date(m.due_on) : null
		};
		await upsertMilestoneFromRef(project.id, ref);
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
		case 'check_suite':
			return applyCheckSuite(act, payload);
		case 'milestone':
			return applyMilestone(act, payload);
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
