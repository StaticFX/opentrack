import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { CLOSED_CATEGORIES } from '$lib/constants';
import { isPriorityLabel, priorityLabelSpecs } from '$lib/github-labels';
import { db, schema } from '$lib/server/db';
import { boardEvent } from '$lib/server/realtime/board';
import { rankAfter } from '$lib/server/util/rank';
import { installationOctokit } from './app';
import { resolveGithubUsers } from './identity';
import { issueMilestone, issueToTicketFields, parseRepo } from './map';

/** Minimal Octokit surface we use — lets tests inject a fake client. */
export interface OctokitLike {
	request(route: string, params?: Record<string, unknown>): Promise<{ data: unknown }>;
}

// The installation Octokit only reliably exposes `.request` (no paginate
// plugin), so we page manually via per_page + page until a short page.
export async function fetchAll<T>(
	octokit: OctokitLike,
	route: string,
	params: Record<string, unknown>
): Promise<T[]> {
	const out: T[] = [];
	for (let page = 1; page <= 50; page++) {
		const res = await octokit.request(route, { ...params, per_page: 100, page });
		const data = res.data as T[];
		if (!Array.isArray(data) || data.length === 0) break;
		out.push(...data);
		if (data.length < 100) break;
	}
	return out;
}

function pickOpenColumn(cols: Array<{ id: string; category: string }>) {
	return (
		cols.find((c) => c.category === 'backlog') ??
		cols.find((c) => c.category === 'todo') ??
		cols.find((c) => !CLOSED_CATEGORIES.includes(c.category as never)) ??
		cols[0]
	);
}
function pickClosedColumn(cols: Array<{ id: string; category: string }>) {
	return cols.find((c) => c.category === 'done') ?? cols.find((c) => c.category === 'canceled') ?? cols.at(-1);
}

/** Repo name + description straight from GitHub (used to seed the new project). */
export async function fetchRepoMeta(
	installationId: string,
	repoFullName: string
): Promise<{ name: string; description: string | null }> {
	const repo = parseRepo(repoFullName);
	if (!repo) throw new Error('Invalid repository name');
	const octokit = await installationOctokit(installationId);
	const res = await octokit.request('GET /repos/{owner}/{repo}', repo);
	return { name: res.data.name, description: res.data.description ?? null };
}

interface GhLabel {
	name: string;
	color: string | null;
	description: string | null;
}
interface GhIssue {
	number: number;
	node_id?: string;
	title: string;
	body?: string | null;
	state: string;
	pull_request?: unknown;
	labels?: Array<string | { name?: string }>;
	assignees?: Array<{ login?: string | null; id?: number; avatar_url?: string | null }> | null;
	milestone?: {
		number?: number;
		id?: number;
		title?: string;
		description?: string | null;
		state?: string;
		due_on?: string | null;
	} | null;
}

interface GhMilestone {
	number: number;
	id?: number;
	title?: string;
	description?: string | null;
	state?: string;
	due_on?: string | null;
}

interface GhRelease {
	id: number;
	tag_name?: string;
	name?: string | null;
	body?: string | null;
	draft?: boolean;
	published_at?: string | null;
	html_url?: string;
}
interface GhPull {
	number: number;
	title?: string;
	body?: string | null;
	state?: string;
	merged_at?: string | null;
}

/** Per-import choices from the settings modal. */
export interface ImportOptions {
	importIssues: boolean;
	importPrs: boolean;
	importReleases: boolean;
	importMilestones: boolean;
	/** Mirror issue assignees to linked OpenTrack users + a display snapshot. */
	syncAssignees: boolean;
	/** Read ticket priority from `priority: <level>` labels + seed those labels. */
	syncPriority: boolean;
	/** Names of repo labels to import; null imports all. */
	issueLabels: string[] | null;
	/** Board column names to create "Status: <name>" GitHub labels for. */
	progressColumns: string[];
}

const DEFAULT_OPTIONS: ImportOptions = {
	importIssues: true,
	importPrs: true,
	importReleases: true,
	importMilestones: true,
	syncAssignees: true,
	syncPriority: true,
	issueLabels: null,
	progressColumns: []
};

export interface ImportResult {
	labels: number;
	issues: number;
	prs: number;
	releases: number;
	progressLabels: number;
	milestones: number;
}

/** Create arbitrary labels on the repo (idempotent-ish; 422 = already exists). */
async function postRepoLabels(
	octokit: OctokitLike,
	repo: { owner: string; repo: string },
	labels: Array<{ name: string; color: string }>
): Promise<number> {
	let n = 0;
	for (const l of labels) {
		try {
			await octokit.request('POST /repos/{owner}/{repo}/labels', {
				...repo,
				name: l.name,
				color: (l.color || '#6b7280').replace(/^#/, '')
			});
			n++;
		} catch {
			// already exists / no permission — non-fatal
		}
	}
	return n;
}

/** Create `Status: <col>` labels on the repo (idempotent-ish; 422 = exists). */
async function postStatusLabels(
	octokit: OctokitLike,
	repo: { owner: string; repo: string },
	columns: Array<{ name: string; color: string }>
): Promise<number> {
	let n = 0;
	for (const c of columns) {
		try {
			await octokit.request('POST /repos/{owner}/{repo}/labels', {
				...repo,
				name: `Status: ${c.name}`,
				color: (c.color || '#6b7280').replace(/^#/, '')
			});
			n++;
		} catch {
			// already exists / no permission — non-fatal
		}
	}
	return n;
}

/** Create `Status: <col>` labels for a linked repo (used from project settings). */
export async function createStatusLabels(
	installationId: string,
	repoFullName: string,
	columns: Array<{ name: string; color: string }>
): Promise<number> {
	const repo = parseRepo(repoFullName);
	if (!repo || columns.length === 0) return 0;
	const octokit = await installationOctokit(installationId);
	return postStatusLabels(octokit, repo, columns);
}

/** Repo labels (name + color) for the import settings modal. */
export async function fetchRepoLabels(
	installationId: string,
	repoFullName: string
): Promise<Array<{ name: string; color: string }>> {
	const repo = parseRepo(repoFullName);
	if (!repo) return [];
	const octokit = await installationOctokit(installationId);
	const labels = await fetchAll<GhLabel>(octokit, 'GET /repos/{owner}/{repo}/labels', repo);
	return labels.map((l) => ({ name: l.name, color: `#${(l.color || '6b7280').replace(/^#/, '')}` }));
}

/**
 * Import a GitHub repo's labels and issues into an existing (linked) project.
 * Issues become tickets (open/closed → open/closed column), labels are created
 * and attached. Idempotent: skips labels/issues already present, so it is safe
 * to re-run. Meant to be driven from a background job.
 */
export async function importRepo(
	opts: {
		projectId: string;
		installationId: string;
		repoFullName: string;
		options?: Partial<ImportOptions>;
	},
	injectedOctokit?: OctokitLike
): Promise<ImportResult> {
	const o: ImportOptions = { ...DEFAULT_OPTIONS, ...(opts.options ?? {}) };
	const empty: ImportResult = { labels: 0, issues: 0, prs: 0, releases: 0, progressLabels: 0, milestones: 0 };
	const repo = parseRepo(opts.repoFullName);
	if (!repo) return empty;
	const octokit = injectedOctokit ?? (await installationOctokit(opts.installationId));

	const [board] = await db
		.select()
		.from(schema.boards)
		.where(eq(schema.boards.projectId, opts.projectId))
		.orderBy(asc(schema.boards.position))
		.limit(1);
	if (!board) return empty;
	const cols = await db
		.select({
			id: schema.boardColumns.id,
			name: schema.boardColumns.name,
			category: schema.boardColumns.category,
			color: schema.boardColumns.color
		})
		.from(schema.boardColumns)
		.where(eq(schema.boardColumns.boardId, board.id))
		.orderBy(asc(schema.boardColumns.position));
	if (cols.length === 0) return empty;
	const openCol = pickOpenColumn(cols);
	const closedCol = pickClosedColumn(cols);

	// ── Issue labels (only the selected subset; null = all) ──
	// Priority labels are managed separately (they set ticket priority), so they
	// are never imported as plain project labels when priority sync is on.
	const wanted = o.issueLabels ? new Set(o.issueLabels) : null;
	const ghLabels = (await fetchAll<GhLabel>(octokit, 'GET /repos/{owner}/{repo}/labels', repo)).filter(
		(l) =>
			l.name &&
			(!wanted || wanted.has(l.name)) &&
			!(o.syncPriority && isPriorityLabel(l.name)) &&
			!l.name.startsWith('Status: ')
	);
	const existingLabels = await db
		.select({ id: schema.labels.id, name: schema.labels.name })
		.from(schema.labels)
		.where(eq(schema.labels.projectId, opts.projectId));
	const labelIdByName = new Map(existingLabels.map((l) => [l.name, l.id]));
	let labelCount = 0;
	for (const l of ghLabels) {
		if (labelIdByName.has(l.name)) continue;
		const color = `#${(l.color || '6b7280').replace(/^#/, '')}`;
		const [row] = await db
			.insert(schema.labels)
			.values({ projectId: opts.projectId, name: l.name, color, description: l.description ?? null })
			.returning({ id: schema.labels.id });
		labelIdByName.set(l.name, row.id);
		labelCount++;
	}

	// ── Progress labels: create a "Status: <col>" label on GitHub per selected column ──
	const progressCols = o.progressColumns
		.map((name) => cols.find((c) => c.name === name))
		.filter((c): c is (typeof cols)[number] => !!c)
		.map((c) => ({ name: c.name, color: c.color }));
	const progressLabelCount = await postStatusLabels(octokit, repo, progressCols);

	// ── Priority labels: seed `priority: <level>` labels on the repo ──
	if (o.syncPriority) {
		await postRepoLabels(octokit, repo, priorityLabelSpecs());
	}

	// ── Milestones → local milestones (keyed by GitHub number) ──
	const milestoneIdByNumber = new Map<number, string>();
	let milestoneCount = 0;
	if (o.importMilestones) {
		const existingMs = await db
			.select({ id: schema.milestones.id, num: schema.milestones.githubMilestoneNumber })
			.from(schema.milestones)
			.where(eq(schema.milestones.projectId, opts.projectId));
		for (const m of existingMs) if (m.num != null) milestoneIdByNumber.set(m.num, m.id);

		const ghMilestones = await fetchAll<GhMilestone>(octokit, 'GET /repos/{owner}/{repo}/milestones', {
			...repo,
			state: 'all'
		});
		for (const m of ghMilestones) {
			if (milestoneIdByNumber.has(m.number)) continue;
			const ref = issueMilestone(m);
			if (!ref) continue;
			const [row] = await db
				.insert(schema.milestones)
				.values({
					projectId: opts.projectId,
					title: ref.title,
					description: ref.description,
					state: ref.state,
					dueDate: ref.dueOn,
					githubMilestoneNumber: ref.number,
					githubMilestoneId: ref.githubMilestoneId,
					githubSyncedAt: new Date()
				})
				.returning({ id: schema.milestones.id });
			milestoneIdByNumber.set(m.number, row.id);
			milestoneCount++;
		}
	}

	// ── Issues → tickets ──
	const issues = o.importIssues
		? await fetchAll<GhIssue>(octokit, 'GET /repos/{owner}/{repo}/issues', { ...repo, state: 'all' })
		: [];
	const existing = await db
		.select({ n: schema.tickets.githubIssueNumber })
		.from(schema.tickets)
		.where(eq(schema.tickets.projectId, opts.projectId));
	const have = new Set(existing.map((e) => e.n).filter((n): n is number => n != null));

	const [{ max }] = await db
		.select({ max: sql<number>`coalesce(max(${schema.tickets.number}), 0)` })
		.from(schema.tickets)
		.where(eq(schema.tickets.projectId, opts.projectId));
	let num = Number(max);

	// Running fractional position per column (seeded from the column's current tail).
	const lastPos = new Map<string, string | null>();
	const nextPos = async (colId: string): Promise<string> => {
		if (!lastPos.has(colId)) {
			const [last] = await db
				.select({ position: schema.tickets.position })
				.from(schema.tickets)
				.where(and(eq(schema.tickets.boardId, board.id), eq(schema.tickets.columnId, colId)))
				.orderBy(desc(schema.tickets.position))
				.limit(1);
			lastPos.set(colId, last?.position ?? null);
		}
		const pos = rankAfter(lastPos.get(colId) ?? null);
		lastPos.set(colId, pos);
		return pos;
	};

	let issueCount = 0;
	for (const issue of issues) {
		if (issue.pull_request) continue; // the issues endpoint also returns PRs
		if (have.has(issue.number)) continue;
		const fields = issueToTicketFields(issue);
		const col = fields.closed ? closedCol : openCol;
		if (!col) continue;
		num++;
		// Assignees: resolve GitHub logins → linked OpenTrack users (+ snapshot).
		const resolved = o.syncAssignees
			? await resolveGithubUsers(fields.assignees.map((a) => a.login))
			: new Map();
		const [ticket] = await db
			.insert(schema.tickets)
			.values({
				projectId: opts.projectId,
				boardId: board.id,
				columnId: col.id,
				milestoneId:
					o.importMilestones && fields.milestone
						? (milestoneIdByNumber.get(fields.milestone.number) ?? null)
						: null,
				number: num,
				title: fields.title,
				description: fields.description,
				priority: o.syncPriority ? fields.priority : 'none',
				position: await nextPos(col.id),
				githubIssueNumber: fields.githubIssueNumber,
				githubNodeId: fields.githubNodeId,
				githubAssignees: o.syncAssignees ? fields.assignees : null,
				closedAt: fields.closed ? new Date() : null,
				githubSyncedAt: new Date()
			})
			.returning({ id: schema.tickets.id });

		// Attach the imported (non-priority) labels that exist as project labels.
		for (const name of fields.labels) {
			const labelId = labelIdByName.get(name);
			if (labelId) {
				await db
					.insert(schema.ticketLabels)
					.values({ ticketId: ticket.id, labelId })
					.onConflictDoNothing();
			}
		}
		// Attach resolved assignees.
		for (const u of resolved.values()) {
			await db
				.insert(schema.ticketAssignees)
				.values({ ticketId: ticket.id, userId: u.userId })
				.onConflictDoNothing();
		}
		issueCount++;
	}

	await boardEvent(board.id, 'ticket.synced', { imported: issueCount });

	// ── Pull requests → link to the ticket(s) they reference ──
	let prCount = 0;
	if (o.importPrs) {
		try {
			const pulls = await fetchAll<GhPull>(octokit, 'GET /repos/{owner}/{repo}/pulls', {
				...repo,
				state: 'all'
			});
			for (const pr of pulls) {
				const refs = [...`${pr.title ?? ''} ${pr.body ?? ''}`.matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
				if (refs.length === 0) continue;
				const prState = pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : 'open';
				const upd = await db
					.update(schema.tickets)
					.set({ githubPrNumber: pr.number, githubPrState: prState })
					.where(
						and(
							eq(schema.tickets.projectId, opts.projectId),
							inArray(schema.tickets.githubIssueNumber, refs)
						)
					)
					.returning({ id: schema.tickets.id });
				prCount += upd.length;
			}
		} catch {
			prCount = 0; // no PR access — non-fatal
		}
	}

	// ── Releases (best-effort — needs Contents:read; skip silently if denied) ──
	let releaseCount = 0;
	if (o.importReleases) try {
		const ghReleases = await fetchAll<GhRelease>(octokit, 'GET /repos/{owner}/{repo}/releases', repo);
		const existingRel = await db
			.select({ gh: schema.releases.githubReleaseId })
			.from(schema.releases)
			.where(eq(schema.releases.projectId, opts.projectId));
		const haveRel = new Set(existingRel.map((r) => r.gh).filter((v): v is string => v != null));
		for (const rel of ghReleases) {
			const ghId = String(rel.id);
			if (haveRel.has(ghId)) continue;
			const [ins] = await db
				.insert(schema.releases)
				.values({
					projectId: opts.projectId,
					version: rel.tag_name || rel.name || 'untagged',
					name: rel.name ?? null,
					notes: rel.body ?? null,
					status: rel.draft ? 'draft' : 'published',
					releasedAt: rel.published_at ? new Date(rel.published_at) : null,
					githubReleaseId: ghId
				})
				.onConflictDoNothing() // (projectId, version) unique — skip collisions
				.returning({ id: schema.releases.id });
			if (ins?.id) {
				if (rel.html_url) {
					await db
						.insert(schema.releaseLinks)
						.values({ releaseId: ins.id, label: 'View on GitHub', url: rel.html_url, type: 'github' });
				}
				releaseCount++;
			}
		}
	} catch {
		releaseCount = 0; // releases permission not granted, or none — non-fatal
	}

	return {
		labels: labelCount,
		issues: issueCount,
		prs: prCount,
		releases: releaseCount,
		progressLabels: progressLabelCount,
		milestones: milestoneCount
	};
}
