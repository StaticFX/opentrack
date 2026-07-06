import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/access';
import { listNotifications, unreadCount } from '$lib/server/services/notifications';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requireUser(locals.user);
	const unreadOnly = url.searchParams.get('unread') === '1';
	const limit = Math.min(Number(url.searchParams.get('limit')) || 30, 100);
	const [items, unread] = await Promise.all([
		listNotifications(user.id, { unreadOnly, limit }),
		unreadCount(user.id)
	]);
	return json({ items, unread });
};
