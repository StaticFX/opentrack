import { error, fail } from '@sveltejs/kit';
import { OAUTH_PROVIDERS } from '$lib/constants';
import { getConfigView, setSetting } from '$lib/server/config';
import { env } from '$lib/server/env';
import type { Actions, PageServerLoad } from './$types';

function requireAdmin(locals: App.Locals) {
	if (!locals.user?.isAdmin) throw error(403, 'Admins only');
}

/** Where to register each provider's OAuth app + a short setup pointer. */
const PROVIDER_META: Record<string, { docs: string; console: string }> = {
	github: {
		docs: 'https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app',
		console: 'https://github.com/settings/developers'
	},
	discord: {
		docs: 'https://discord.com/developers/docs/topics/oauth2',
		console: 'https://discord.com/developers/applications'
	},
	modrinth: {
		docs: 'https://docs.modrinth.com/api/#section/OAuth',
		console: 'https://modrinth.com/settings/applications'
	}
};

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const config = await getConfigView();
	return {
		oauth: config.oauth.map((p) => ({ ...p, meta: PROVIDER_META[p.provider] })),
		oauthCallback: `${env.origin}/auth/oauth/{provider}/callback`
	};
};

export const actions: Actions = {
	saveOAuth: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const provider = String(form.get('provider') ?? '');
		if (!OAUTH_PROVIDERS.includes(provider as never)) return fail(400, { error: 'Unknown provider.' });
		const clientId = String(form.get('clientId') ?? '').trim();
		const clientSecret = String(form.get('clientSecret') ?? '').trim();

		if (!clientId) {
			// Clearing the client id disables the provider.
			await setSetting(`oauth.${provider}.clientId`, null);
			await setSetting(`oauth.${provider}.clientSecret`, null);
		} else {
			await setSetting(`oauth.${provider}.clientId`, clientId);
			if (clientSecret) await setSetting(`oauth.${provider}.clientSecret`, clientSecret, true);
		}
		return { savedOAuth: provider };
	}
};
