import { redirect } from '@sveltejs/kit';
import { OAUTH_PROVIDERS, type OAuthProvider } from '$lib/constants';
import { enabledProviders } from '$lib/server/auth/oauth';
import { listLinkedAccounts, unlinkOAuthAccount } from '$lib/server/auth/user';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/auth/login');
	const [linked, providers] = await Promise.all([
		listLinkedAccounts(locals.user.id),
		enabledProviders()
	]);
	return {
		linked,
		enabledProviders: providers,
		isAdmin: locals.user.isAdmin
	};
};

export const actions: Actions = {
	unlink: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/auth/login');
		const provider = String((await request.formData()).get('provider') ?? '');
		if (OAUTH_PROVIDERS.includes(provider as OAuthProvider)) {
			await unlinkOAuthAccount(locals.user.id, provider as OAuthProvider);
		}
		return { unlinked: true };
	}
};
