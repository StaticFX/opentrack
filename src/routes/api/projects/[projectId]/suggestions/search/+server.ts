import { json } from '@sveltejs/kit';
import { requireProjectAccess } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { searchSuggestions } from '$lib/server/services/suggestions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, url }) => {
	// Merge is a maintainer action, so gate the picker to project managers.
	await requireProjectAccess(locals.user, params.projectId, ACCESS.MAINTAINER);
	const q = url.searchParams.get('q') ?? '';
	const exclude = url.searchParams.get('exclude') ?? undefined;
	return json({ suggestions: await searchSuggestions(params.projectId, q, exclude) });
};
