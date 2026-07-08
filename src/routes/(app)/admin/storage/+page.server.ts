import { error, fail } from '@sveltejs/kit';
import { getConfig, getConfigView, invalidateConfig, setSetting } from '$lib/server/config';
import { testS3 } from '$lib/server/uploads';
import type { Actions, PageServerLoad } from './$types';

function requireAdmin(locals: App.Locals) {
	if (!locals.user?.isAdmin) throw error(403, 'Admins only');
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const config = await getConfigView();
	return { storage: config.storage };
};

export const actions: Actions = {
	saveStorage: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const str = (k: string) => String(form.get(k) ?? '').trim();

		// Non-secret fields (empty clears them).
		await setSetting('storage.s3.endpoint', str('endpoint') || null);
		await setSetting('storage.s3.region', str('region') || null);
		await setSetting('storage.s3.bucket', str('bucket') || null);
		await setSetting('storage.s3.accessKeyId', str('accessKeyId') || null);
		await setSetting('storage.s3.forcePathStyle', form.get('forcePathStyle') === 'on' ? '1' : null);
		// Secret: blank keeps the existing one.
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
		return { saved: true };
	},

	testStorage: async ({ locals }) => {
		requireAdmin(locals);
		const s3 = (await getConfig()).storage.s3;
		if (!s3) return fail(400, { testError: 'Save S3 credentials first, then test.' });
		const res = await testS3(s3);
		if (!res.ok) return fail(400, { testError: res.error ?? 'Connection failed.' });
		return { tested: true };
	}
};
