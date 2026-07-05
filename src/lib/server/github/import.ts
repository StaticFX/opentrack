import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { CLOSED_CATEGORIES } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import { boardEvent } from '$lib/server/realtime/board';
import { rankAfter } from '$lib/server/util/rank';
import { installationOctokit } from './app';
import { issueToTicketFields, parseRepo } from './map';

/** Minimal Octokit surface we use — lets tests inject a fake client. */
export interface OctokitLike {
	request(route: string, params?: Record<string, unknown>): Promise<{ data: unknown }>;
}

// The installation Octokit only reliably exposes `.request` (no paginate
// plugin), so we page manually via per_page + page until a short page.
async function fetchAll<T>(
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
}

export interface ImportResult {
	labels: number;
	issues: number;
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
	},
	injectedOctokit?: OctokitLike
): Promise<ImportResult> {
	const repo = parseRepo(opts.repoFullName);
	if (!repo) return { labels: 0, issues: 0 };
	const octokit = injectedOctokit ?? (await installationOctokit(opts.installationId));

	const [board] = await db
		.select()
		.from(schema.boards)
		.where(eq(schema.boards.projectId, opts.projectId))
		.orderBy(asc(schema.boards.position))
		.limit(1);
	if (!board) return { labels: 0, issues: 0 };
	const cols = await db
		.select({ id: schema.boardColumns.id, category: schema.boardColumns.category })
		.from(schema.boardColumns)
		.where(eq(schema.boardColumns.boardId, board.id))
		.orderBy(asc(schema.boardColumns.position));
	if (cols.length === 0) return { labels: 0, issues: 0 };
	const openCol = pickOpenColumn(cols);
	const closedCol = pickClosedColumn(cols);

	// ── Labels ──
	const ghLabels = await fetchAll<GhLabel>(octokit, 'GET /repos/{owner}/{repo}/labels', repo);
	const existingLabels = await db
		.select({ id: schema.labels.id, name: schema.labels.name })
		.from(schema.labels)
		.where(eq(schema.labels.projectId, opts.projectId));
	const labelIdByName = new Map(existingLabels.map((l) => [l.name, l.id]));
	let labelCount = 0;
	for (const l of ghLabels) {
		if (!l.name || labelIdByName.has(l.name)) continue;
		const color = `#${(l.color || '6b7280').replace(/^#/, '')}`;
		const [row] = await db
			.insert(schema.labels)
			.values({ projectId: opts.projectId, name: l.name, color, description: l.description ?? null })
			.returning({ id: schema.labels.id });
		labelIdByName.set(l.name, row.id);
		labelCount++;
	}

	// ── Issues → tickets ──
	const issues = await fetchAll<GhIssue>(octokit, 'GET /repos/{owner}/{repo}/issues', {
		...repo,
		state: 'all'
	});
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
		const [ticket] = await db
			.insert(schema.tickets)
			.values({
				projectId: opts.projectId,
				boardId: board.id,
				columnId: col.id,
				number: num,
				title: fields.title,
				description: fields.description,
				position: await nextPos(col.id),
				githubIssueNumber: fields.githubIssueNumber,
				githubNodeId: fields.githubNodeId,
				closedAt: fields.closed ? new Date() : null,
				githubSyncedAt: new Date()
			})
			.returning({ id: schema.tickets.id });

		for (const lbl of issue.labels ?? []) {
			const name = typeof lbl === 'string' ? lbl : lbl?.name;
			const labelId = name ? labelIdByName.get(name) : undefined;
			if (labelId) {
				await db
					.insert(schema.ticketLabels)
					.values({ ticketId: ticket.id, labelId })
					.onConflictDoNothing();
			}
		}
		issueCount++;
	}

	await boardEvent(board.id, 'ticket.synced', { imported: issueCount });
	return { labels: labelCount, issues: issueCount };
}
