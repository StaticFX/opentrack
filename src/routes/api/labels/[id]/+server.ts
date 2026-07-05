import { json } from '@sveltejs/kit';
import { requireLabelAccess, requireUser } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { deleteLabel, updateLabel } from '$lib/server/services/labels';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	requireUser(locals.user);
	await requireLabelAccess(locals.user, params.id, ACCESS.MAINTAINER);
	const body = await request.json();
	await updateLabel(params.id, {
		...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
		...(typeof body.color === 'string' ? { color: body.color } : {})
	});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	requireUser(locals.user);
	await requireLabelAccess(locals.user, params.id, ACCESS.MAINTAINER);
	await deleteLabel(params.id);
	return json({ ok: true });
};
