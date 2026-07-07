import { enqueue } from '$lib/server/jobs';
import { subjectRef } from '$lib/server/services/notifications';
import {
	getNotificationProvider,
	notificationCatalogKeys,
	resolveNotificationState
} from './registry';

export interface NotifyOpts {
	actor?: string;
	description?: string;
	fields?: Array<{ name: string; value: string }>;
}

/**
 * Fan an event out to every enabled Notifications-category integration on a
 * project (Discord, Slack, …). Guards each provider on its stored config first,
 * resolves the subject link once, then enqueues one `integration:notify` job
 * per interested provider. Best-effort — never throws into the caller.
 */
export async function notifyIntegrations(
	projectId: string,
	event: string,
	subjectType: string,
	subjectId: string,
	opts: NotifyOpts = {}
): Promise<void> {
	try {
		// Which providers are installed, enabled, and listening for this event?
		const targets: string[] = [];
		for (const key of notificationCatalogKeys()) {
			const provider = getNotificationProvider(key);
			if (!provider) continue;
			const state = await resolveNotificationState(provider, projectId);
			if (!state?.enabled || !state.secrets.webhookUrl) continue;
			const events = state.config.events ?? provider.defaultEvents;
			if (events.includes(event)) targets.push(key);
		}
		if (targets.length === 0) return;

		const ref = await subjectRef(subjectType, subjectId);
		const data = {
			title: ref?.title ?? 'Update',
			url: ref?.url,
			description: opts.description,
			actor: opts.actor,
			fields: opts.fields
		};
		for (const key of targets) {
			await enqueue('integration:notify', { projectId, key, event, data });
		}
	} catch (err) {
		console.warn('[integrations] notify enqueue failed:', err);
	}
}
