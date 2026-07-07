// Request-facing helpers for per-project notification integrations (Discord,
// Slack, …). Backed by the generic store; the settings UI and API talk to these
// so adding a provider needs no new endpoint or action.
import { env } from '$lib/server/env';
import { getNotificationProvider, resolveNotificationState } from './registry';
import { deleteIntegration, upsertIntegration } from './store';
import type { NotificationConfig, NotificationSecrets } from './types';

export interface NotificationView {
	installed: boolean;
	enabled: boolean;
	hasWebhook: boolean;
	events: string[];
}

/** Non-secret view of a project's notification integration for the settings UI. */
export async function getNotificationView(
	projectId: string,
	key: string
): Promise<NotificationView> {
	const provider = getNotificationProvider(key);
	if (!provider) return { installed: false, enabled: false, hasWebhook: false, events: [] };
	const st = await resolveNotificationState(provider, projectId);
	if (!st) return { installed: false, enabled: false, hasWebhook: false, events: provider.defaultEvents };
	return {
		installed: true,
		enabled: st.enabled,
		hasWebhook: !!st.secrets.webhookUrl,
		events: st.config.events ?? provider.defaultEvents
	};
}

export interface SaveNotificationInput {
	enabled?: boolean;
	/** New webhook URL. Blank/undefined keeps the current one; null clears it. */
	webhookUrl?: string | null;
	events?: string[];
}

/** Validate + persist a notification integration's config. Returns an error string on failure. */
export async function saveNotificationConfig(
	projectId: string,
	key: string,
	input: SaveNotificationInput
): Promise<{ error?: string }> {
	const provider = getNotificationProvider(key);
	if (!provider) return { error: 'Unknown integration.' };

	const current = await resolveNotificationState(provider, projectId);
	let secrets: NotificationSecrets | undefined;
	if (input.webhookUrl === null) {
		secrets = {};
	} else if (input.webhookUrl && input.webhookUrl.trim()) {
		const url = input.webhookUrl.trim();
		const err = provider.validateWebhook(url);
		if (err) return { error: err };
		secrets = { webhookUrl: url };
	} else if (current) {
		// Blank URL → keep the existing secret (must re-supply it on upsert).
		secrets = current.secrets;
	}

	const config: NotificationConfig = {
		events: input.events ?? current?.config.events ?? provider.defaultEvents
	};
	await upsertIntegration(projectId, key, {
		enabled: input.enabled ?? current?.enabled ?? true,
		config,
		secrets
	});
	return {};
}

/** Send a sample announcement to verify the webhook. */
export async function testNotification(
	projectId: string,
	key: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
	const provider = getNotificationProvider(key);
	if (!provider) return { ok: false, error: 'Unknown integration.' };
	const st = await resolveNotificationState(provider, projectId);
	if (!st?.secrets.webhookUrl) return { ok: false, error: 'No webhook configured.' };
	const body = provider.buildPayload({
		event: 'ticket.created',
		title: 'Test notification',
		description: 'If you can see this, the webhook works. 🎉',
		origin: env.origin
	});
	const { ok, status } = await provider.post(st.secrets.webhookUrl, body);
	return ok ? { ok } : { ok, status, error: `Webhook returned ${status}` };
}

/** Remove a project's integration entirely. */
export async function removeNotificationConfig(projectId: string, key: string): Promise<void> {
	await deleteIntegration(projectId, key);
}
