import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { enqueue } from '$lib/server/jobs/queue';

/** Enqueue an outbound push for a ticket, only if its project is GitHub-linked. */
export async function enqueueTicketPush(ticketId: string): Promise<void> {
	const [row] = await db
		.select({ repo: schema.projects.githubRepo, inst: schema.projects.githubInstallationId })
		.from(schema.tickets)
		.innerJoin(schema.projects, eq(schema.tickets.projectId, schema.projects.id))
		.where(eq(schema.tickets.id, ticketId))
		.limit(1);
	if (row?.repo && row?.inst) await enqueue('github:push-ticket', { ticketId });
}

/** Enqueue an outbound push for a ticket comment, only if the project is linked. */
export async function enqueueCommentPush(commentId: string, ticketId: string): Promise<void> {
	const [row] = await db
		.select({ repo: schema.projects.githubRepo, inst: schema.projects.githubInstallationId })
		.from(schema.tickets)
		.innerJoin(schema.projects, eq(schema.tickets.projectId, schema.projects.id))
		.where(eq(schema.tickets.id, ticketId))
		.limit(1);
	if (row?.repo && row?.inst) await enqueue('github:push-comment', { commentId });
}

/** Enqueue an outbound milestone push, only if its project is GitHub-linked. */
export async function enqueueMilestonePush(milestoneId: string): Promise<void> {
	const [row] = await db
		.select({ repo: schema.projects.githubRepo, inst: schema.projects.githubInstallationId })
		.from(schema.milestones)
		.innerJoin(schema.projects, eq(schema.milestones.projectId, schema.projects.id))
		.where(eq(schema.milestones.id, milestoneId))
		.limit(1);
	if (row?.repo && row?.inst) await enqueue('github:push-milestone', { milestoneId });
}
