import { requireUser } from '$lib/server/access';
import { listAssignedTo, listDueSoon, listWatching } from '$lib/server/services/mywork';
import { listNotifications } from '$lib/server/services/notifications';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals.user);
	const [assigned, dueSoon, watching, notifications] = await Promise.all([
		listAssignedTo(user),
		listDueSoon(user, 7),
		listWatching(user),
		listNotifications(user.id, { limit: 8 })
	]);
	return { assigned, dueSoon, watching, notifications };
};
