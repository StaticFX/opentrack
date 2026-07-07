import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { pushComment, pushTicket } from '$lib/server/github/sync';
import type { IssueTrackerProvider } from '../types';

/**
 * GitHub issue-tracking provider. A thin adapter over the existing, richer
 * `server/github` engine (webhooks, PRs, milestones, releases, import stay
 * there) — this just exposes GitHub through the common IssueTrackerProvider
 * seam so the registry and future generic call paths don't special-case it.
 * GitHub still stores its link on the `projects.github_*` columns.
 */
export const githubProvider: IssueTrackerProvider = {
	key: 'github',
	async isLinked(projectId: string) {
		const [row] = await db
			.select({ repo: schema.projects.githubRepo, inst: schema.projects.githubInstallationId })
			.from(schema.projects)
			.where(eq(schema.projects.id, projectId))
			.limit(1);
		return !!(row?.repo && row?.inst);
	},
	pushTicket(ticketId, actorUserId) {
		return pushTicket(ticketId, actorUserId);
	},
	pushComment(commentId, actorUserId) {
		return pushComment(commentId, actorUserId);
	}
};
