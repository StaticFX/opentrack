import { error, json } from '@sveltejs/kit';
import { CUSTOM_FIELD_TYPES, type CustomFieldType } from '$lib/customFields';
import { requireProjectAccess } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { createField, listFields } from '$lib/server/services/custom-fields';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	await requireProjectAccess(locals.user, params.projectId);
	return json({ fields: await listFields(params.projectId) });
};

export const POST: RequestHandler = async ({ params, locals, request }) => {
	await requireProjectAccess(locals.user, params.projectId, ACCESS.MAINTAINER);
	const body = await request.json();
	const name = String(body.name ?? '').trim().slice(0, 60);
	const type = String(body.type ?? '') as CustomFieldType;
	if (!name) throw error(400, 'Name is required');
	if (!CUSTOM_FIELD_TYPES.includes(type)) throw error(400, 'Invalid field type');
	const options =
		type === 'select'
			? (Array.isArray(body.options) ? body.options : [])
					.map((o: unknown) => String(o).trim())
					.filter(Boolean)
					.slice(0, 40)
			: null;
	if (type === 'select' && !options!.length) throw error(400, 'A select field needs at least one option');
	const id = await createField(params.projectId, { name, type, options });
	return json({ id });
};
