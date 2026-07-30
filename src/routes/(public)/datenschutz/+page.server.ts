import { getConfig } from '$lib/server/config';
import { env } from '$lib/server/env';
import { buildDatenschutzTemplate } from '$lib/server/legal';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const cfg = await getConfig();
	// Stored policy wins; otherwise render the generated template that reflects
	// this instance's actual data processing.
	const body =
		cfg.legal.datenschutz.trim() ||
		buildDatenschutzTemplate(cfg.legal.impressum, {
			origin: env.origin,
			siteName: cfg.site.name
		});
	return { body };
};
