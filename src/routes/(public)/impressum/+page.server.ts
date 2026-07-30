import { getConfig, impressumConfigured } from '$lib/server/config';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const cfg = await getConfig();
	return {
		impressum: cfg.legal.impressum,
		configured: impressumConfigured(cfg.legal.impressum)
	};
};
