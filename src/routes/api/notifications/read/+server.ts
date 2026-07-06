import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/access';
import { markRead, unreadCount } from '$lib/server/services/notifications';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireUser(locals.user);
	const body = await request.json().catch(() => ({}));
	const ids = Array.isArray(body.ids) ? body.ids.map(String) : undefined;
	await markRead(user.id, ids);
	return json({ unread: await unreadCount(user.id) });
};
