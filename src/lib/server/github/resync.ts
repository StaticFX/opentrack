import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { enqueue } from '$lib/server/jobs/queue';
import { installationOctokit } from './app';
import { fetchAll } from './import';
import { parseRepo } from './map';

export interface ResyncReport {
	/** GitHub issues with no matching local ticket (queued for import). */
	missingLocal: number;
	/** Local tickets not yet on GitHub (queued to be pushed as new issues). */
	missingRemote: number;
}

/** Just the `number` + PR marker off the issues endpoint (which also lists PRs). */
interface GhIssueRef {
	number: number;
	pull_request?: unknown;
}

/**
 * Reconcile a GitHub-linked project in both directions. Fetches the repo's
 * issues, diffs them against local tickets, and enqueues the work to close the
 * gap:
 *  - GitHub → app: a `github:import` pass (idempotent; skips issues we already
 *    have) when any issue is missing locally.
 *  - app → GitHub: one `github:push-ticket` per local ticket lacking an issue
 *    number; `pushTicket` creates the issue and back-fills the number.
 *
 * Returns the detected counts so the caller can report what was reconciled.
 * Throws if the project isn't linked to a valid repository.
 */
export async function resyncProject(projectId: string): Promise<ResyncReport> {
	const [project] = await db
		.select({
			repo: schema.projects.githubRepo,
			inst: schema.projects.githubInstallationId
		})
		.from(schema.projects)
		.where(eq(schema.projects.id, projectId))
		.limit(1);
	if (!project?.repo || !project.inst) {
		throw new Error('This project is not linked to a GitHub repository.');
	}
	const repo = parseRepo(project.repo);
	if (!repo) throw new Error('Invalid repository name.');

	// Remote side: all issue numbers (PRs are returned here too — drop them).
	const octokit = await installationOctokit(project.inst);
	const issues = await fetchAll<GhIssueRef>(octokit, 'GET /repos/{owner}/{repo}/issues', {
		...repo,
		state: 'all'
	});
	const remoteNumbers = new Set(issues.filter((i) => !i.pull_request).map((i) => i.number));

	// Local side: every ticket + whether it carries a GitHub issue number.
	const tickets = await db
		.select({ id: schema.tickets.id, gh: schema.tickets.githubIssueNumber })
		.from(schema.tickets)
		.where(eq(schema.tickets.projectId, projectId));
	const localNumbers = new Set(tickets.map((t) => t.gh).filter((n): n is number => n != null));
	const unpushed = tickets.filter((t) => t.gh == null);

	// GitHub → app: issues we don't have locally.
	let missingLocal = 0;
	for (const n of remoteNumbers) if (!localNumbers.has(n)) missingLocal++;

	// app → GitHub: local tickets that were never pushed.
	const missingRemote = unpushed.length;

	// Import is idempotent — only run it when there's something to pull.
	if (missingLocal > 0) {
		await enqueue('github:import', {
			projectId,
			installationId: project.inst,
			repoFullName: project.repo
		});
	}
	// Push each unpushed ticket (project is already known-linked).
	for (const t of unpushed) {
		await enqueue('github:push-ticket', { ticketId: t.id, actorUserId: null });
	}

	return { missingLocal, missingRemote };
}
