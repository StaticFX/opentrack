import { requireUser } from '$lib/server/access';
import { listNotifications, markRead, unreadCount } from '$lib/server/services/notifications';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals.user);
	const [items, unread] = await Promise.all([
		listNotifications(user.id, { limit: 100 }),
		unreadCount(user.id)
	]);
	return { items, unread };
};

export const actions: Actions = {
	readAll: async ({ locals }) => {
		const user = requireUser(locals.user);
		await markRead(user.id);
		return { ok: true };
	}
};
