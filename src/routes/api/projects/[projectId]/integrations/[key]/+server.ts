import { error, json } from '@sveltejs/kit';
import { requireProjectAccess } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { getNotificationProvider } from '$lib/server/integrations/registry';
import {
	getNotificationView,
	removeNotificationConfig,
	saveNotificationConfig
} from '$lib/server/integrations/service';
import type { RequestHandler } from './$types';

/** Guard: notification-category providers are the ones this generic endpoint serves. */
function requireNotificationProvider(key: string) {
	if (!getNotificationProvider(key)) throw error(404, 'Unknown integration');
}

export const GET: RequestHandler = async ({ params, locals }) => {
	await requireProjectAccess(locals.user, params.projectId, ACCESS.MAINTAINER);
	requireNotificationProvider(params.key);
	return json({ state: await getNotificationView(params.projectId, params.key) });
};

export const PUT: RequestHandler = async ({ params, locals, request }) => {
	await requireProjectAccess(locals.user, params.projectId, ACCESS.MAINTAINER);
	requireNotificationProvider(params.key);
	const body = await request.json();
	const events = Array.isArray(body.events) ? body.events.map((e: unknown) => String(e)) : undefined;
	const res = await saveNotificationConfig(params.projectId, params.key, {
		enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
		webhookUrl: body.webhookUrl === null ? null : body.webhookUrl ? String(body.webhookUrl) : undefined,
		events
	});
	if (res.error) throw error(400, res.error);
	return json({ state: await getNotificationView(params.projectId, params.key) });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireProjectAccess(locals.user, params.projectId, ACCESS.MAINTAINER);
	requireNotificationProvider(params.key);
	await removeNotificationConfig(params.projectId, params.key);
	return json({ ok: true });
};
