import { fail, redirect } from '@sveltejs/kit';
import { OAUTH_PROVIDERS, type OAuthProvider } from '$lib/constants';
import { enabledProviders } from '$lib/server/auth/oauth';
import { verifyPassword } from '$lib/server/auth/password';
import { generateTotpSecret, totpQrSvg, verifyTotp } from '$lib/server/auth/totp';
import {
	getUserById,
	listLinkedAccounts,
	setUserPassword,
	setUserTotp,
	unlinkOAuthAccount
} from '$lib/server/auth/user';
import { decryptSecret } from '$lib/server/crypto';
import { getConfig } from '$lib/server/config';
import { countPushSubscriptions } from '$lib/server/services/notifications';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/auth/login');
	const [linked, providers, dbUser, cfg, pushCount] = await Promise.all([
		listLinkedAccounts(locals.user.id),
		enabledProviders(),
		getUserById(locals.user.id),
		getConfig(),
		countPushSubscriptions(locals.user.id)
	]);

	// Two-factor state: on | pending (secret set, not yet confirmed) | off.
	let totp: { state: 'on' | 'pending' | 'off'; qrSvg?: string; secret?: string } = { state: 'off' };
	if (dbUser?.totpEnabled) {
		totp = { state: 'on' };
	} else if (dbUser?.totpSecret) {
		try {
			const secret = decryptSecret(dbUser.totpSecret);
			totp = { state: 'pending', secret, qrSvg: await totpQrSvg(secret, dbUser.username) };
		} catch {
			totp = { state: 'off' };
		}
	}

	return {
		linked,
		enabledProviders: providers,
		isAdmin: locals.user.isAdmin,
		hasPassword: !!dbUser?.passwordHash,
		totp,
		push: {
			// VAPID public key is safe to expose; browsers need it to subscribe.
			publicKey: cfg.push.publicKey ?? null,
			configured: !!(cfg.push.publicKey && cfg.push.privateKey),
			subscribed: pushCount > 0
		}
	};
};

export const actions: Actions = {
	unlink: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/auth/login');
		const provider = String((await request.formData()).get('provider') ?? '');
		if (OAUTH_PROVIDERS.includes(provider as OAuthProvider) || provider) {
			await unlinkOAuthAccount(locals.user.id, provider);
		}
		return { unlinked: true };
	},

	changePassword: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/auth/login');
		const form = await request.formData();
		const current = String(form.get('current') ?? '');
		const next = String(form.get('next') ?? '');
		const confirm = String(form.get('confirm') ?? '');
		if (next.length < 8) return fail(400, { pwError: 'New password must be at least 8 characters.' });
		if (next !== confirm) return fail(400, { pwError: "New passwords don't match." });

		const user = await getUserById(locals.user.id);
		if (user?.passwordHash) {
			if (!(await verifyPassword(user.passwordHash, current))) {
				return fail(400, { pwError: 'Current password is incorrect.' });
			}
		}
		await setUserPassword(locals.user.id, next);
		return { pwSaved: true };
	},

	// Begin 2FA setup: generate a secret (stored but not yet enabled).
	startTotp: async ({ locals }) => {
		if (!locals.user) throw redirect(302, '/auth/login');
		await setUserTotp(locals.user.id, generateTotpSecret(), false);
		return { totpStarted: true };
	},

	// Confirm setup: verify a code against the pending secret, then enable.
	confirmTotp: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/auth/login');
		const code = String((await request.formData()).get('code') ?? '');
		const user = await getUserById(locals.user.id);
		if (!user?.totpSecret) return fail(400, { totpError: 'Start setup first.' });
		let secret: string;
		try {
			secret = decryptSecret(user.totpSecret);
		} catch {
			return fail(500, { totpError: 'Secret is unreadable — start over.' });
		}
		if (!verifyTotp(secret, code)) return fail(400, { totpError: 'That code is incorrect — try again.' });
		await setUserTotp(locals.user.id, secret, true);
		return { totpEnabled: true };
	},

	cancelTotp: async ({ locals }) => {
		if (!locals.user) throw redirect(302, '/auth/login');
		await setUserTotp(locals.user.id, null, false);
		return { totpCancelled: true };
	},

	// Turn off 2FA — requires the account password.
	disableTotp: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/auth/login');
		const password = String((await request.formData()).get('password') ?? '');
		const user = await getUserById(locals.user.id);
		if (user?.passwordHash && !(await verifyPassword(user.passwordHash, password))) {
			return fail(400, { totpError: 'Password is incorrect.' });
		}
		await setUserTotp(locals.user.id, null, false);
		return { totpDisabled: true };
	}
};
