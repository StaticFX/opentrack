import { fail, redirect } from '@sveltejs/kit';
import { createWorkspace } from '$lib/server/services/workspaces';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const visibility = String(form.get('visibility') ?? 'public') === 'private' ? 'private' : 'public';
		if (!name) return fail(400, { error: 'Enter a workspace name.', name: '' });

		const ws = await createWorkspace(locals.user!, { name, visibility });
		throw redirect(303, `/w/${ws.slug}`);
	}
};
