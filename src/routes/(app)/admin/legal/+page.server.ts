import { error } from '@sveltejs/kit';
import {
	COOKIE_NOTICE_DEFAULT,
	COOKIE_NOTICE_DEFAULT_EN,
	getConfig,
	getConfigView,
	IMPRESSUM_DEFAULTS,
	setSetting
} from '$lib/server/config';
import { env } from '$lib/server/env';
import { buildPrivacyPolicy } from '$lib/server/legal';
import type { Actions, PageServerLoad } from './$types';

function requireAdmin(locals: App.Locals) {
	if (!locals.user?.isAdmin) throw error(403, 'Admins only');
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const view = await getConfigView();
	const cfg = await getConfig();
	// Templates seeded from the CURRENTLY SAVED Impressum, so "insert template"
	// reflects the operator's real controller details — one per language.
	const opts = { origin: env.origin, siteName: cfg.site.name };
	return {
		legal: view.legal,
		impressumDefaults: IMPRESSUM_DEFAULTS,
		cookieDefault: COOKIE_NOTICE_DEFAULT,
		cookieDefaultEn: COOKIE_NOTICE_DEFAULT_EN,
		datenschutzTemplateDe: buildPrivacyPolicy(cfg.legal.impressum, opts, 'de'),
		datenschutzTemplateEn: buildPrivacyPolicy(cfg.legal.impressum, opts, 'en'),
		origin: env.origin
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const val = (k: string) => String(form.get(k) ?? '').trim();

		// Impressum — blank clears the key so a fresh instance stays empty.
		await setSetting('legal.impressum.provider', val('provider') || null);
		await setSetting('legal.impressum.address', val('address') || null);
		await setSetting('legal.impressum.email', val('email') || null);
		await setSetting('legal.impressum.phone', val('phone') || null);
		await setSetting('legal.impressum.represented', val('represented') || null);
		await setSetting('legal.impressum.register', val('register') || null);
		await setSetting('legal.impressum.vatId', val('vatId') || null);
		await setSetting('legal.impressum.responsible', val('responsible') || null);
		await setSetting('legal.impressum.extra', val('extra') || null);

		// Privacy policy — blank falls back to the generated template per language.
		await setSetting('legal.datenschutz.body', val('datenschutz') || null);
		await setSetting('legal.datenschutz.body_en', val('datenschutzEn') || null);

		// Cookie notice — store '0' only when explicitly disabled (default = on);
		// blank text falls back to the built-in notice copy (per language).
		const cookieEnabled = form.get('cookieEnabled') === 'on';
		await setSetting('legal.cookie.enabled', cookieEnabled ? null : '0');
		await setSetting('legal.cookie.text', val('cookieText') || null);
		await setSetting('legal.cookie.text_en', val('cookieTextEn') || null);

		return { saved: true };
	}
};
