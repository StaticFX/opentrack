import { eq } from 'drizzle-orm';
import { CLOSED_CATEGORIES } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import { getIntegration } from '../store';
import type { FetchLike, IssueTrackerProvider } from '../types';

// ── Config/secret shapes stored in `project_integrations` (key = 'gitlab') ──
export interface GitlabConfig extends Record<string, unknown> {
	/** URL-encoded path or numeric id of the GitLab project, e.g. "group/repo". */
	projectPath?: string;
	/** Self-managed instance base URL; defaults to gitlab.com. */
	baseUrl?: string;
}
export interface GitlabSecrets extends Record<string, unknown> {
	/** Project or personal access token with `api` scope. */
	token?: string;
}

export interface GitlabIssuePayload {
	title: string;
	description: string;
	state_event?: 'close' | 'reopen';
}

/** Pure map: OpenTrack ticket → GitLab issue payload. Unit-testable, no I/O. */
export function buildGitlabIssue(
	ticket: { title: string; description: string | null },
	closed: boolean
): GitlabIssuePayload {
	return {
		title: ticket.title,
		description: ticket.description ?? '',
		...(closed ? { state_event: 'close' } : { state_event: 'reopen' })
	};
}

function apiBase(cfg: GitlabConfig): string {
	const base = (cfg.baseUrl ?? 'https://gitlab.com').replace(/\/+$/, '');
	return `${base}/api/v4/projects/${encodeURIComponent(cfg.projectPath ?? '')}`;
}

/** Create an issue on GitLab. DI-friendly `fetchImpl` so it's testable offline. */
export async function createGitlabIssue(
	cfg: GitlabConfig,
	token: string,
	payload: GitlabIssuePayload,
	fetchImpl: FetchLike = fetch
): Promise<{ iid: number }> {
	const res = await fetchImpl(`${apiBase(cfg)}/issues`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'PRIVATE-TOKEN': token },
		body: JSON.stringify(payload)
	});
	if (!res.ok) throw new Error(`GitLab create issue failed: ${res.status}`);
	return (await res.json()) as { iid: number };
}

/**
 * GitLab issue-tracking provider — a SCAFFOLD proving a second tracker slots
 * into the abstraction with only provider-local code (config in the generic
 * store, no bespoke `projects.*` columns). Catalog status is `soon`: it is NOT
 * wired into the request-path enqueue yet. Completing it needs a per-ticket
 * external-ref (the GitLab issue iid, the analogue of `github_issue_number`) +
 * inbound webhooks — the same shape GitHub already has.
 */
export const gitlabProvider: IssueTrackerProvider = {
	key: 'gitlab',
	async isLinked(projectId: string) {
		const st = await getIntegration<GitlabConfig, GitlabSecrets>(projectId, 'gitlab');
		return !!(st?.enabled && st.secrets.token && st.config.projectPath);
	},
	async pushTicket(ticketId: string, _actorUserId?: string | null) {
		const [row] = await db
			.select({ ticket: schema.tickets })
			.from(schema.tickets)
			.where(eq(schema.tickets.id, ticketId))
			.limit(1);
		if (!row) return;
		const st = await getIntegration<GitlabConfig, GitlabSecrets>(row.ticket.projectId, 'gitlab');
		if (!st?.enabled || !st.secrets.token || !st.config.projectPath) return;

		let closed = false;
		if (row.ticket.columnId) {
			const [c] = await db
				.select({ category: schema.boardColumns.category })
				.from(schema.boardColumns)
				.where(eq(schema.boardColumns.id, row.ticket.columnId))
				.limit(1);
			closed = CLOSED_CATEGORIES.includes((c?.category ?? '') as never);
		}
		const payload = buildGitlabIssue(row.ticket, closed);
		// Create-only until a per-ticket iid mapping exists (see note above).
		await createGitlabIssue(st.config, st.secrets.token, payload);
	},
	async pushComment(_commentId: string, _actorUserId?: string | null) {
		// Deferred: needs the ticket→GitLab-issue iid mapping to target a note.
	}
};
