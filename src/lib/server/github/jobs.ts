import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { registerHandler } from '$lib/server/jobs/queue';
import { importRepo } from './import';
import { applyWebhookEvent, closeIssue, pushComment, pushMilestone, pushTicket } from './sync';

export function registerGithubHandlers(): void {
	// Inbound: apply a stored webhook event to local state (idempotent).
	registerHandler('github:webhook', async (payload) => {
		const eventId = String(payload.eventId ?? '');
		const [row] = await db
			.select()
			.from(schema.githubWebhookEvents)
			.where(eq(schema.githubWebhookEvents.id, eventId))
			.limit(1);
		if (!row || row.processed) return;
		try {
			await applyWebhookEvent(row.event, row.action, row.payload as unknown);
			await db
				.update(schema.githubWebhookEvents)
				.set({ processed: true })
				.where(eq(schema.githubWebhookEvents.id, eventId));
		} catch (err) {
			await db
				.update(schema.githubWebhookEvents)
				.set({ error: err instanceof Error ? err.message : String(err) })
				.where(eq(schema.githubWebhookEvents.id, eventId));
			throw err;
		}
	});

	// Outbound: push local changes to GitHub. `actorUserId` (when present) is the
	// user whose identity the write should be attributed to; see github/client.ts.
	registerHandler('github:push-ticket', async (payload) => {
		await pushTicket(String(payload.ticketId ?? ''), (payload.actorUserId as string | null) ?? null);
	});
	registerHandler('github:push-comment', async (payload) => {
		await pushComment(String(payload.commentId ?? ''), (payload.actorUserId as string | null) ?? null);
	});
	registerHandler('github:push-milestone', async (payload) => {
		await pushMilestone(String(payload.milestoneId ?? ''), (payload.actorUserId as string | null) ?? null);
	});
	// Close a linked issue for a ticket that has been deleted (self-contained payload).
	registerHandler('github:close-issue', async (payload) => {
		const issueNumber = Number(payload.issueNumber);
		if (!Number.isInteger(issueNumber)) return;
		const reason = payload.stateReason === 'completed' ? 'completed' : 'not_planned';
		await closeIssue(
			String(payload.installationId ?? ''),
			String(payload.repoFullName ?? ''),
			issueNumber,
			reason
		);
	});

	// Import: pull a repo's labels + issues into a freshly created project.
	registerHandler('github:import', async (payload) => {
		await importRepo({
			projectId: String(payload.projectId ?? ''),
			installationId: String(payload.installationId ?? ''),
			repoFullName: String(payload.repoFullName ?? ''),
			options: (payload.options as Record<string, unknown>) ?? undefined
		});
	});
}
