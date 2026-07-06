import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/access';
import { deletePushSubscription } from '$lib/server/services/notifications';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireUser(locals.user);
	const body = await request.json().catch(() => ({}));
	const endpoint = body?.endpoint ? String(body.endpoint) : '';
	if (endpoint) await deletePushSubscription(user.id, endpoint);
	return json({ ok: true });
};
