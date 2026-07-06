import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { registerHandler } from '$lib/server/jobs/queue';
import { importRepo } from './import';
import { applyWebhookEvent, pushComment, pushMilestone, pushTicket } from './sync';

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

	// Outbound: push local changes to GitHub.
	registerHandler('github:push-ticket', async (payload) => {
		await pushTicket(String(payload.ticketId ?? ''));
	});
	registerHandler('github:push-comment', async (payload) => {
		await pushComment(String(payload.commentId ?? ''));
	});
	registerHandler('github:push-milestone', async (payload) => {
		await pushMilestone(String(payload.milestoneId ?? ''));
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
