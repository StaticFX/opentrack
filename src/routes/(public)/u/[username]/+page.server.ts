import { error } from '@sveltejs/kit';
import { getPublicProfile } from '$lib/server/services/profiles';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const profile = await getPublicProfile(params.username);
	if (!profile) throw error(404, 'Profile not found');
	return { profile };
};
