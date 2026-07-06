import { error } from '@sveltejs/kit';
import { getConfigView, setSetting } from '$lib/server/config';
import { generateVapidKeys } from '$lib/server/push';
import type { Actions, PageServerLoad } from './$types';

function requireAdmin(locals: App.Locals) {
	if (!locals.user?.isAdmin) throw error(403, 'Admins only');
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const config = await getConfigView();
	return { push: config.push };
};

export const actions: Actions = {
	// One-click: mint a VAPID keypair and store it (private key encrypted).
	generate: async ({ locals }) => {
		requireAdmin(locals);
		const keys = await generateVapidKeys();
		await setSetting('push.publicKey', keys.publicKey);
		await setSetting('push.privateKey', keys.privateKey, true);
		return { generated: true };
	},

	saveSubject: async ({ request, locals }) => {
		requireAdmin(locals);
		const subject = String((await request.formData()).get('subject') ?? '').trim();
		await setSetting('push.subject', subject || null);
		return { savedSubject: true };
	},

	// Paste an externally-generated keypair (e.g. shared across instances).
	saveKeys: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const publicKey = String(form.get('publicKey') ?? '').trim();
		const privateKey = String(form.get('privateKey') ?? '').trim();
		if (!publicKey || !privateKey) return { error: 'Both keys are required.' };
		await setSetting('push.publicKey', publicKey);
		await setSetting('push.privateKey', privateKey, true);
		return { savedKeys: true };
	},

	disable: async ({ locals }) => {
		requireAdmin(locals);
		await setSetting('push.publicKey', null);
		await setSetting('push.privateKey', null);
		return { disabled: true };
	}
};
