import { fail, redirect } from '@sveltejs/kit';
import { redeemInviteCode } from '$lib/server/auth/invite';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (!locals.user) {
		const target = `/auth/invite${url.search}`;
		throw redirect(302, `/auth/login?redirect=${encodeURIComponent(target)}`);
	}
	return { prefill: url.searchParams.get('code') ?? '' };
};

const ERRORS: Record<string, string> = {
	not_found: 'That code is not valid.',
	expired: 'That invite code has expired.',
	exhausted: 'That invite code has already been used up.'
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/auth/login');
		const form = await request.formData();
		const code = String(form.get('code') ?? '').trim();
		if (!code) return fail(400, { error: 'Enter an invite code.', code: '' });

		const result = await redeemInviteCode(locals.user, code);
		if (!result.ok) return fail(400, { error: ERRORS[result.reason], code });

		throw redirect(302, '/dashboard');
	}
};
