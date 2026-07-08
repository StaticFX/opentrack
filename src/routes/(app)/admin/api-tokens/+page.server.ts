import { asc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { normalizeScopes } from '$lib/apiScopes';
import { db, schema } from '$lib/server/db';
import { createApiKey, listAllApiKeys, revokeApiKeyById } from '$lib/server/services/api-keys';
import type { Actions, PageServerLoad } from './$types';

function requireAdmin(locals: App.Locals) {
	if (!locals.user?.isAdmin) throw error(403, 'Admins only');
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const workspaces = await db
		.select({ id: schema.workspaces.id, name: schema.workspaces.name })
		.from(schema.workspaces)
		.orderBy(asc(schema.workspaces.name));
	return { keys: await listAllApiKeys(), workspaces };
};

export const actions: Actions = {
	createKey: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const workspaceId = String(form.get('workspaceId') ?? '');
		const name = String(form.get('name') ?? '').trim().slice(0, 60) || 'API key';
		const scopes = normalizeScopes(form.getAll('scope').map(String));
		if (!workspaceId) return { error: 'Pick a workspace.' };
		const { raw, key } = await createApiKey(workspaceId, name, locals.user!.id, scopes.length ? scopes : ['read']);
		return { apiKeyRaw: raw, apiKeyName: key.name };
	},

	revokeKey: async ({ request, locals }) => {
		requireAdmin(locals);
		const id = String((await request.formData()).get('id') ?? '');
		if (id) await revokeApiKeyById(id);
		return { revoked: true };
	}
};
