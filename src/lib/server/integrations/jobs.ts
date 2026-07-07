import { env } from '$lib/server/env';
import { registerHandler } from '$lib/server/jobs/queue';
import { getNotificationProvider, resolveNotificationState } from './registry';
import { upsertIntegration } from './store';
import type { NotifyContext } from './types';

export function registerIntegrationHandlers(): void {
	registerHandler('integration:notify', async (payload) => {
		const projectId = String(payload.projectId ?? '');
		const key = String(payload.key ?? '');
		const event = String(payload.event ?? '');
		const data = (payload.data ?? {}) as Partial<NotifyContext>;
		if (!projectId || !key || !event) return;

		const provider = getNotificationProvider(key);
		if (!provider) return;

		// Re-read config at delivery time — it may have changed since enqueue.
		const state = await resolveNotificationState(provider, projectId);
		if (!state?.enabled) return;
		const webhookUrl = state.secrets.webhookUrl;
		if (!webhookUrl) return;
		const events = state.config.events ?? provider.defaultEvents;
		if (!events.includes(event)) return;

		const body = provider.buildPayload({
			event,
			title: data.title ?? 'Update',
			url: data.url,
			description: data.description,
			actor: data.actor,
			fields: data.fields,
			origin: env.origin
		});
		const { ok, status } = await provider.post(webhookUrl, body);
		if (ok) return;

		// Webhook deleted/revoked → clear the secret so we stop retrying a dead
		// endpoint (leaves the integration installed but disconnected).
		if (status === 404 || status === 401 || status === 403) {
			await upsertIntegration(projectId, key, { secrets: {} });
			return;
		}
		// Rate-limited or transient → throw so the queue retries with backoff.
		throw new Error(`${key} webhook returned ${status}`);
	});
}
