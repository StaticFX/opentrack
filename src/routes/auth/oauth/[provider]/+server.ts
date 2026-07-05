import { error, redirect } from '@sveltejs/kit';
import { generateState } from 'arctic';
import { getOAuthAdapter, setOAuthCookies } from '$lib/server/auth/oauth';
import { safeRedirect } from '$lib/server/util/redirect';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, cookies, url, locals }) => {
	const adapter = await getOAuthAdapter(params.provider);
	if (!adapter) throw error(404, 'Unknown or disabled login provider');

	const state = generateState();
	const redirectTo = safeRedirect(url.searchParams.get('redirect'));
	// "link" mode attaches this identity to the current user instead of logging
	// in — only meaningful when someone is already signed in.
	const link = url.searchParams.get('link') === '1' && !!locals.user;
	setOAuthCookies(cookies, state, redirectTo, link);

	throw redirect(302, adapter.createAuthorizationURL(state).toString());
};
