import { getConfig, impressumConfigured } from '$lib/server/config';
import { resolveLang } from '$lib/server/legal';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const lang = resolveLang(url.searchParams.get('lang'));
	const cfg = await getConfig();
	return {
		impressum: cfg.legal.impressum,
		configured: impressumConfigured(cfg.legal.impressum),
		lang
	};
};
