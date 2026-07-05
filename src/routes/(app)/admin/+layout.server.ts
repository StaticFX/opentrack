import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// The parent (app) layout already requires an authenticated user with internal
// access; here we additionally require the admin flag.
export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user?.isAdmin) {
		throw error(403, 'Admins only');
	}
	return {};
};
