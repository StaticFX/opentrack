import { sendPushToUser } from '$lib/server/push';
import { registerHandler } from './queue';

/** Job handlers for notification delivery (currently just Web Push). */
export function registerNotifyHandlers(): void {
	registerHandler('notify:push', async (payload) => {
		const userId = String(payload.userId ?? '');
		if (!userId) return;
		await sendPushToUser(userId, {
			title: String(payload.title ?? 'OpenTrack'),
			body: payload.body ? String(payload.body) : undefined,
			url: String(payload.url ?? '/'),
			tag: payload.tag ? String(payload.tag) : undefined
		});
	});
}
