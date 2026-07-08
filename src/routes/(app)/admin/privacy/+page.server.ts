import { error, fail } from '@sveltejs/kit';
import {
	callbackUrl,
	deleteCustomProvider,
	listProvidersView,
	saveBuiltinProvider,
	upsertCustomProvider
} from '$lib/server/auth/oauth';
import { env } from '$lib/server/env';
import type { Actions, PageServerLoad } from './$types';

function requireAdmin(locals: App.Locals) {
	if (!locals.user?.isAdmin) throw error(403, 'Admins only');
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	return {
		providers: await listProvidersView(),
		oauthCallback: callbackUrl('{provider}'),
		origin: env.origin
	};
};

export const actions: Actions = {
	// Save a built-in provider's credentials + enabled flag.
	saveBuiltin: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const key = String(form.get('key') ?? '');
		try {
			await saveBuiltinProvider(key, {
				clientId: String(form.get('clientId') ?? '').trim(),
				clientSecret: String(form.get('clientSecret') ?? '').trim() || undefined,
				enabled: form.get('enabled') === 'on'
			});
			return { saved: key };
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Could not save provider.' });
		}
	},

	// Create or update a custom OAuth2 / OIDC provider.
	saveCustom: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const val = (k: string) => String(form.get(k) ?? '').trim();
		try {
			await upsertCustomProvider({
				id: val('id') || undefined,
				key: val('key'),
				label: val('label'),
				icon: val('icon') || null,
				discoveryUrl: val('discoveryUrl') || undefined,
				authorizationEndpoint: val('authorizationEndpoint') || undefined,
				tokenEndpoint: val('tokenEndpoint') || undefined,
				userinfoEndpoint: val('userinfoEndpoint') || undefined,
				scopes: val('scopes'),
				clientId: val('clientId'),
				clientSecret: val('clientSecret') || undefined,
				enabled: form.get('enabled') === 'on'
			});
			return { saved: 'custom' };
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Could not save provider.' });
		}
	},

	deleteCustom: async ({ request, locals }) => {
		requireAdmin(locals);
		const id = String((await request.formData()).get('id') ?? '');
		if (id) await deleteCustomProvider(id);
		return { deleted: true };
	}
};
