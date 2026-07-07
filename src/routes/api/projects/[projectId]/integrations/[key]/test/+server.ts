import { error, json } from '@sveltejs/kit';
import { requireProjectAccess } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { getNotificationProvider } from '$lib/server/integrations/registry';
import { testNotification } from '$lib/server/integrations/service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	await requireProjectAccess(locals.user, params.projectId, ACCESS.MAINTAINER);
	if (!getNotificationProvider(params.key)) throw error(404, 'Unknown integration');
	const res = await testNotification(params.projectId, params.key);
	if (!res.ok) throw error(400, res.error ?? 'Test failed');
	return json({ ok: true });
};
