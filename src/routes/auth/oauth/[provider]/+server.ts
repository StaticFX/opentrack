import { error, redirect } from '@sveltejs/kit';
import { generateState } from 'arctic';
import { getOAuthAdapter, setOAuthCookies } from '$lib/server/auth/oauth';
import { safeRedirect } from '$lib/server/util/redirect';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, cookies, url }) => {
	const adapter = await getOAuthAdapter(params.provider);
	if (!adapter) throw error(404, 'Unknown or disabled login provider');

	const state = generateState();
	const redirectTo = safeRedirect(url.searchParams.get('redirect'));
	setOAuthCookies(cookies, state, redirectTo);

	throw redirect(302, adapter.createAuthorizationURL(state).toString());
};
