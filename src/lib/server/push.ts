// Web Push (VAPID) delivery. Kept isolated so `web-push` (a CJS module) is only
// loaded when push is actually configured and used.
import { eq } from 'drizzle-orm';
import { getConfig } from './config';
import { db, schema } from './db';

export interface PushPayload {
	title: string;
	body?: string;
	url: string;
	tag?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function lib(): Promise<any> {
	return (await import('web-push')).default;
}

/** Generate a fresh VAPID keypair (for the admin "generate keys" action). */
export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
	const webpush = await lib();
	return webpush.generateVAPIDKeys();
}

/**
 * Deliver a push notification to every registered device of a user. Silently
 * no-ops when push isn't configured or the user has no subscriptions. Dead
 * endpoints (404/410) are pruned automatically.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
	const cfg = await getConfig();
	if (!cfg.push.publicKey || !cfg.push.privateKey) return;

	const subs = await db
		.select()
		.from(schema.pushSubscriptions)
		.where(eq(schema.pushSubscriptions.userId, userId));
	if (!subs.length) return;

	const webpush = await lib();
	webpush.setVapidDetails(cfg.push.subject, cfg.push.publicKey, cfg.push.privateKey);
	const body = JSON.stringify(payload);

	await Promise.all(
		subs.map(async (s) => {
			try {
				await webpush.sendNotification(
					{ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
					body
				);
			} catch (err) {
				const code = (err as { statusCode?: number }).statusCode;
				if (code === 404 || code === 410) {
					await db
						.delete(schema.pushSubscriptions)
						.where(eq(schema.pushSubscriptions.id, s.id));
				} else {
					console.warn('[push] send failed:', code ?? err);
				}
			}
		})
	);
}
