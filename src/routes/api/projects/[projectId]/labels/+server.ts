import { error, json } from '@sveltejs/kit';
import { requireProjectAccess, requireUser } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { createLabel, listLabels } from '$lib/server/services/labels';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	await requireProjectAccess(locals.user, params.projectId);
	return json({ labels: await listLabels(params.projectId) });
};

export const POST: RequestHandler = async ({ params, locals, request }) => {
	requireUser(locals.user);
	await requireProjectAccess(locals.user, params.projectId, ACCESS.MAINTAINER);
	const body = await request.json();
	const name = String(body.name ?? '').trim();
	const color = String(body.color ?? '#6b7280');
	if (!name) throw error(400, 'Label name is required');
	const label = await createLabel(params.projectId, { name, color });
	return json(label);
};
