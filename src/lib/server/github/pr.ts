import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { installationOctokit } from './app';
import type { OctokitLike } from './import';
import { aggregateCheckStatus, type CiStatus, parseRepo } from './map';

/** A GitHub-linked project's coordinates. */
interface RepoCtx {
	id: string;
	githubRepo: string | null;
	githubInstallationId: string | null;
}

/** An open PR surfaced in the manual link picker. */
export interface PrCandidate {
	number: number;
	title: string;
	draft: boolean;
	headRef: string;
	state: string;
	url: string;
}

interface RawPull {
	number: number;
	title?: string;
	draft?: boolean;
	state?: string;
	html_url?: string;
	head?: { ref?: string; sha?: string };
}

/** List open PRs in the project's linked repo, optionally filtered by `q`. */
export async function listOpenPRs(
	project: RepoCtx,
	q?: string,
	injected?: OctokitLike
): Promise<PrCandidate[]> {
	const repo = parseRepo(project.githubRepo);
	if (!repo || !project.githubInstallationId) return [];
	const octokit = injected ?? (await installationOctokit(project.githubInstallationId));
	const res = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
		...repo,
		state: 'open',
		per_page: 50,
		sort: 'updated',
		direction: 'desc'
	});
	const pulls = (res.data as RawPull[]) ?? [];
	const term = q?.trim().toLowerCase();
	return pulls
		.filter((p) => {
			if (!term) return true;
			return String(p.number) === term.replace(/^#/, '') || (p.title ?? '').toLowerCase().includes(term);
		})
		.map((p) => ({
			number: p.number,
			title: p.title ?? `#${p.number}`,
			draft: !!p.draft,
			headRef: p.head?.ref ?? '',
			state: p.state ?? 'open',
			url: p.html_url ?? ''
		}));
}

/** Fetch the aggregate CI status for a commit SHA (best-effort; null on error). */
async function fetchCiForSha(
	octokit: OctokitLike,
	owner: string,
	repo: string,
	sha: string
): Promise<CiStatus | null> {
	try {
		const res = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', {
			owner,
			repo,
			ref: sha,
			per_page: 100
		});
		const runs = ((res.data as { check_runs?: Array<{ status?: string; conclusion?: string }> })
			.check_runs ?? []);
		return aggregateCheckStatus(runs);
	} catch {
		return null;
	}
}

/** The ticket + its project's repo coordinates, or null. */
async function ticketRepoCtx(ticketId: string) {
	const [row] = await db
		.select({
			id: schema.tickets.id,
			githubRepo: schema.projects.githubRepo,
			githubInstallationId: schema.projects.githubInstallationId
		})
		.from(schema.tickets)
		.innerJoin(schema.projects, eq(schema.tickets.projectId, schema.projects.id))
		.where(eq(schema.tickets.id, ticketId))
		.limit(1);
	return row ?? null;
}

/**
 * Manually link a PR to a ticket (sticky — auto-match won't override it).
 * Fetches the PR's current state + head SHA + aggregate CI immediately.
 */
export async function linkPr(
	ticketId: string,
	prNumber: number,
	injected?: OctokitLike
): Promise<boolean> {
	const ctx = await ticketRepoCtx(ticketId);
	const repo = parseRepo(ctx?.githubRepo);
	if (!ctx || !repo || !ctx.githubInstallationId) return false;
	const octokit = injected ?? (await installationOctokit(ctx.githubInstallationId));

	const res = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
		...repo,
		pull_number: prNumber
	});
	const pr = res.data as RawPull & { merged?: boolean };
	const state = pr.merged ? 'merged' : pr.state === 'closed' ? 'closed' : 'open';
	const headSha = pr.head?.sha ?? null;
	const ci = headSha ? await fetchCiForSha(octokit, repo.owner, repo.repo, headSha) : null;

	await db
		.update(schema.tickets)
		.set({
			githubPrNumber: prNumber,
			githubPrState: state,
			githubPrHeadRef: pr.head?.ref ?? null,
			githubPrHeadSha: headSha,
			githubPrLinkSource: 'manual',
			githubCiStatus: ci,
			githubCiUpdatedAt: new Date()
		})
		.where(eq(schema.tickets.id, ticketId));
	return true;
}

/** Clear all PR/CI columns on a ticket. */
export async function unlinkPr(ticketId: string): Promise<void> {
	await db
		.update(schema.tickets)
		.set({
			githubPrNumber: null,
			githubPrState: null,
			githubPrHeadRef: null,
			githubPrHeadSha: null,
			githubPrLinkSource: null,
			githubCiStatus: null,
			githubCiUpdatedAt: null
		})
		.where(eq(schema.tickets.id, ticketId));
}
