import { enqueue } from '$lib/server/jobs';
import { subjectRef } from '$lib/server/services/notifications';
import { discordEnabledFor } from './config';
import type { DiscordEventData } from './send';

/**
 * Enqueue a Discord announcement for a subject, guarding on config first so the
 * subjectRef lookup and job insert are skipped when Discord is off or the event
 * is disabled. Best-effort — never throws into the caller.
 */
export async function enqueueDiscordForSubject(
	projectId: string,
	event: string,
	subjectType: string,
	subjectId: string,
	opts: { actor?: string; description?: string; fields?: DiscordEventData['fields'] } = {}
): Promise<void> {
	try {
		if (!(await discordEnabledFor(projectId, event))) return;
		const ref = await subjectRef(subjectType, subjectId);
		await enqueue('discord:notify', {
			projectId,
			event,
			data: {
				title: ref?.title ?? 'Update',
				url: ref?.url,
				description: opts.description,
				actor: opts.actor,
				fields: opts.fields
			}
		});
	} catch (err) {
		console.warn('[discord] enqueue failed:', err);
	}
}
