import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/access';
import { globalSearch } from '$lib/server/services/search';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requireUser(locals.user);
	const q = url.searchParams.get('q') ?? '';
	return json(await globalSearch(user, q));
};
