import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The admin panel is tab-driven; land on Users by default.
export const load: PageServerLoad = () => {
	throw redirect(302, '/admin/users');
};
