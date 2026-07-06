import { error, json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/access';
import { savePushSubscription } from '$lib/server/services/notifications';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireUser(locals.user);
	const body = await request.json().catch(() => null);
	const endpoint = body?.endpoint ? String(body.endpoint) : '';
	const p256dh = body?.keys?.p256dh ? String(body.keys.p256dh) : '';
	const auth = body?.keys?.auth ? String(body.keys.auth) : '';
	if (!endpoint || !p256dh || !auth) throw error(400, 'Invalid subscription');
	await savePushSubscription(user.id, { endpoint, p256dh, auth });
	return json({ ok: true });
};
