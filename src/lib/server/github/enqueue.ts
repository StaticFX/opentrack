import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { enqueue } from '$lib/server/jobs/queue';

/**
 * Enqueue an outbound push for a ticket, only if its project is GitHub-linked.
 * `actorUserId` is the OpenTrack user who triggered the change; it rides along
 * so the push can eventually be attributed to them on GitHub (see
 * `github/client.ts`). Omitted → the App bot pushes, as today.
 */
export async function enqueueTicketPush(
	ticketId: string,
	actorUserId?: string | null
): Promise<void> {
	const [row] = await db
		.select({ repo: schema.projects.githubRepo, inst: schema.projects.githubInstallationId })
		.from(schema.tickets)
		.innerJoin(schema.projects, eq(schema.tickets.projectId, schema.projects.id))
		.where(eq(schema.tickets.id, ticketId))
		.limit(1);
	if (row?.repo && row?.inst) await enqueue('github:push-ticket', { ticketId, actorUserId });
}

/** Enqueue an outbound push for a ticket comment, only if the project is linked. */
export async function enqueueCommentPush(
	commentId: string,
	ticketId: string,
	actorUserId?: string | null
): Promise<void> {
	const [row] = await db
		.select({ repo: schema.projects.githubRepo, inst: schema.projects.githubInstallationId })
		.from(schema.tickets)
		.innerJoin(schema.projects, eq(schema.tickets.projectId, schema.projects.id))
		.where(eq(schema.tickets.id, ticketId))
		.limit(1);
	if (row?.repo && row?.inst) await enqueue('github:push-comment', { commentId, actorUserId });
}

/** Enqueue an outbound milestone push, only if its project is GitHub-linked. */
export async function enqueueMilestonePush(
	milestoneId: string,
	actorUserId?: string | null
): Promise<void> {
	const [row] = await db
		.select({ repo: schema.projects.githubRepo, inst: schema.projects.githubInstallationId })
		.from(schema.milestones)
		.innerJoin(schema.projects, eq(schema.milestones.projectId, schema.projects.id))
		.where(eq(schema.milestones.id, milestoneId))
		.limit(1);
	if (row?.repo && row?.inst) await enqueue('github:push-milestone', { milestoneId, actorUserId });
}

/**
 * Enqueue a close of a ticket's linked GitHub issue, capturing the repo +
 * issue number NOW so the job survives the local ticket being deleted. No-op
 * when the project isn't linked or the ticket has no issue. Call BEFORE delete.
 */
export async function enqueueIssueCloseForTicket(
	ticketId: string,
	stateReason: 'completed' | 'not_planned' = 'not_planned'
): Promise<void> {
	const [row] = await db
		.select({
			issueNumber: schema.tickets.githubIssueNumber,
			repo: schema.projects.githubRepo,
			inst: schema.projects.githubInstallationId
		})
		.from(schema.tickets)
		.innerJoin(schema.projects, eq(schema.tickets.projectId, schema.projects.id))
		.where(eq(schema.tickets.id, ticketId))
		.limit(1);
	if (row?.repo && row?.inst && row.issueNumber != null) {
		await enqueue('github:close-issue', {
			installationId: row.inst,
			repoFullName: row.repo,
			issueNumber: row.issueNumber,
			stateReason
		});
	}
}
