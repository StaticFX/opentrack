import { getConfig } from '$lib/server/config';
import { env } from '$lib/server/env';
import { buildPrivacyPolicy, resolveLang } from '$lib/server/legal';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const lang = resolveLang(url.searchParams.get('lang'));
	const cfg = await getConfig();
	// Stored policy for this language wins; otherwise render the generated
	// template that reflects this instance's actual data processing.
	const body =
		cfg.legal.datenschutz[lang].trim() ||
		buildPrivacyPolicy(cfg.legal.impressum, { origin: env.origin, siteName: cfg.site.name }, lang);
	return { body, lang };
};
