import { env } from '$lib/server/env';
import { registerHandler } from '$lib/server/jobs/queue';
import { getProjectDiscord, setProjectDiscord } from './config';
import { buildDiscordPayload, postDiscord, type DiscordEventData } from './send';

export function registerDiscordHandlers(): void {
	registerHandler('discord:notify', async (payload) => {
		const projectId = String(payload.projectId ?? '');
		const event = String(payload.event ?? '');
		const data = (payload.data ?? {}) as DiscordEventData;
		if (!projectId || !event) return;

		// Re-read config at delivery time — it may have changed since enqueue.
		const cfg = await getProjectDiscord(projectId);
		if (!cfg.webhookUrl || !cfg.events.includes(event)) return;

		const body = buildDiscordPayload(event, data, env.origin);
		const { ok, status } = await postDiscord(cfg.webhookUrl, body);
		if (ok) return;

		// Webhook deleted/revoked → disable so we stop retrying a dead endpoint.
		if (status === 404 || status === 401 || status === 403) {
			await setProjectDiscord(projectId, { webhookUrl: null });
			return;
		}
		// Rate-limited or transient → throw so the queue retries with backoff.
		throw new Error(`Discord webhook returned ${status}`);
	});
}
