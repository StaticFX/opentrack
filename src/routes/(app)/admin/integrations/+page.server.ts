import { error } from '@sveltejs/kit';
import { getConfigView, setSetting } from '$lib/server/config';
import { env } from '$lib/server/env';
import type { Actions, PageServerLoad } from './$types';

function requireAdmin(locals: App.Locals) {
	if (!locals.user?.isAdmin) throw error(403, 'Admins only');
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const config = await getConfigView();
	return {
		github: config.github,
		urls: {
			setup: `${env.origin}/api/github/setup`,
			webhook: `${env.origin}/api/webhooks/github`,
			newApp: 'https://github.com/settings/apps/new'
		}
	};
};

export const actions: Actions = {
	saveGithub: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const val = (k: string) => String(form.get(k) ?? '').trim();

		// Clearing the App ID fully disconnects (removes secrets too).
		if (!val('appId')) {
			for (const k of ['appId', 'slug', 'clientId', 'privateKey', 'webhookSecret', 'clientSecret']) {
				await setSetting(`github.${k}`, null);
			}
			return { savedGithub: true };
		}

		await setSetting('github.appId', val('appId'));
		await setSetting('github.slug', val('slug') || null);
		await setSetting('github.clientId', val('clientId') || null);
		// Secrets: only overwrite when a new value is provided.
		if (val('privateKey')) await setSetting('github.privateKey', val('privateKey'), true);
		if (val('webhookSecret')) await setSetting('github.webhookSecret', val('webhookSecret'), true);
		if (val('clientSecret')) await setSetting('github.clientSecret', val('clientSecret'), true);
		return { savedGithub: true };
	}
};
