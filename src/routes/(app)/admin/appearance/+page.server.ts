import { error } from '@sveltejs/kit';
import { getConfigView, setSetting, SITE_DEFAULTS } from '$lib/server/config';
import type { Actions, PageServerLoad } from './$types';

function requireAdmin(locals: App.Locals) {
	if (!locals.user?.isAdmin) throw error(403, 'Admins only');
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const config = await getConfigView();
	return { site: config.site, defaults: SITE_DEFAULTS };
};

export const actions: Actions = {
	saveSite: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const val = (k: string) => String(form.get(k) ?? '').trim();
		// Blank clears the override → the built-in default is used again.
		await setSetting('site.name', val('name') || null);
		await setSetting('site.headline', val('headline') || null);
		await setSetting('site.tagline', val('tagline') || null);
		return { savedSite: true };
	}
};
