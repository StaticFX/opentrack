import { error, fail } from '@sveltejs/kit';
import { getConfig, getConfigView, invalidateConfig, setSetting } from '$lib/server/config';
import { testS3 } from '$lib/server/uploads';
import { env } from '$lib/server/env';
import type { Actions, PageServerLoad } from './$types';

function requireAdmin(locals: App.Locals) {
	if (!locals.user?.isAdmin) throw error(403, 'Admins only');
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const config = await getConfigView();
	return {
		github: config.github,
		storage: config.storage,
		mcp: config.mcp,
		urls: {
			setup: `${env.origin}/api/github/setup`,
			webhook: `${env.origin}/api/webhooks/github`,
			newApp: 'https://github.com/settings/apps/new',
			mcp: `${env.origin}/api/mcp`
		}
	};
};

export const actions: Actions = {
	saveGithub: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const val = (k: string) => String(form.get(k) ?? '').trim();

		// Clearing the App ID fully disconnects (removes secrets too).
		if (!val('appId')) {
			for (const k of ['appId', 'slug', 'clientId', 'privateKey', 'webhookSecret', 'clientSecret']) {
				await setSetting(`github.${k}`, null);
			}
			return { savedGithub: true };
		}

		await setSetting('github.appId', val('appId'));
		await setSetting('github.slug', val('slug') || null);
		await setSetting('github.clientId', val('clientId') || null);
		// Secrets: only overwrite when a new value is provided.
		if (val('privateKey')) await setSetting('github.privateKey', val('privateKey'), true);
		if (val('webhookSecret')) await setSetting('github.webhookSecret', val('webhookSecret'), true);
		if (val('clientSecret')) await setSetting('github.clientSecret', val('clientSecret'), true);
		return { savedGithub: true };
	},

	saveStorage: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const str = (k: string) => String(form.get(k) ?? '').trim();

		await setSetting('storage.s3.endpoint', str('endpoint') || null);
		await setSetting('storage.s3.region', str('region') || null);
		await setSetting('storage.s3.bucket', str('bucket') || null);
		await setSetting('storage.s3.accessKeyId', str('accessKeyId') || null);
		await setSetting('storage.s3.forcePathStyle', form.get('forcePathStyle') === 'on' ? '1' : null);
		const secret = str('secretAccessKey');
		if (secret) await setSetting('storage.s3.secretAccessKey', secret, true);

		// Only enable S3 for new uploads once it's fully configured.
		const wantEnabled = form.get('s3Enabled') === 'on';
		invalidateConfig();
		const configured = !!(await getConfig()).storage.s3;
		await setSetting('storage.s3.enabled', wantEnabled && configured ? '1' : null);

		if (wantEnabled && !configured) {
			return fail(400, { error: 'Provide a bucket, access key, and secret before enabling S3.' });
		}
		return { savedStorage: true };
	},

	// Test the credentials typed in the form (blank secret → the stored one).
	testStorage: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const str = (k: string) => String(form.get(k) ?? '').trim();
		const bucket = str('bucket');
		const accessKeyId = str('accessKeyId');
		let secretAccessKey = str('secretAccessKey');
		if (!secretAccessKey) secretAccessKey = (await getConfig()).storage.s3?.secretAccessKey ?? '';
		if (!bucket || !accessKeyId || !secretAccessKey) {
			return fail(400, { testError: 'Enter bucket, access key, and secret to test.' });
		}
		const res = await testS3({
			endpoint: str('endpoint') || undefined,
			region: str('region') || 'auto',
			bucket,
			accessKeyId,
			secretAccessKey,
			forcePathStyle: form.get('forcePathStyle') === 'on'
		});
		if (!res.ok) return fail(400, { testError: res.error ?? 'Connection failed.' });
		return { tested: true };
	},

	saveMcp: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		await setSetting('mcp.enabled', form.get('enabled') === 'on' ? '1' : null);
		return { savedMcp: true };
	}
};
