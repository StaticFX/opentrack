import { error, json } from '@sveltejs/kit';
import { requireProjectAccess } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { deleteField, fieldProject, updateField } from '$lib/server/services/custom-fields';
import type { RequestHandler } from './$types';

async function guard(user: App.Locals['user'], id: string): Promise<void> {
	const projectId = await fieldProject(id);
	if (!projectId) throw error(404, 'Field not found');
	await requireProjectAccess(user, projectId, ACCESS.MAINTAINER);
}

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	await guard(locals.user, params.id);
	const body = await request.json();
	const patch: { name?: string; options?: string[] } = {};
	if (typeof body.name === 'string') {
		const name = body.name.trim().slice(0, 60);
		if (!name) throw error(400, 'Name is required');
		patch.name = name;
	}
	if (Array.isArray(body.options)) {
		patch.options = body.options.map((o: unknown) => String(o).trim()).filter(Boolean).slice(0, 40);
	}
	await updateField(params.id, patch);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	await guard(locals.user, params.id);
	await deleteField(params.id);
	return json({ ok: true });
};
