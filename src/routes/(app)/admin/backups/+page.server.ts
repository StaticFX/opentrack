import { error, fail } from '@sveltejs/kit';
import { getConfigView, setSetting } from '$lib/server/config';
import { createBackup, deleteBackup, listBackups, stageRestore, backupsSupported } from '$lib/server/backup/service';
import { rescheduleBackups } from '$lib/server/backup/jobs';
import { checkBucketPublic } from '$lib/server/uploads';
import type { Actions, PageServerLoad } from './$types';

function requireAdmin(locals: App.Locals) {
	if (!locals.user?.isAdmin) throw error(403, 'Admins only');
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const view = await getConfigView();
	// If S3 is available, check the bucket's visibility so we can warn against
	// storing backups (which contain the whole DB) in a public bucket.
	const bucketVisibility = view.backup.s3Available ? await checkBucketPublic() : null;
	return {
		supported: backupsSupported(),
		config: view.backup,
		bucketVisibility,
		backups: backupsSupported() ? await listBackups() : []
	};
};

export const actions: Actions = {
	backupNow: async ({ locals }) => {
		requireAdmin(locals);
		try {
			const row = await createBackup('manual');
			return { created: row.filename };
		} catch (e) {
			return fail(500, { error: e instanceof Error ? e.message : 'Backup failed.' });
		}
	},

	saveSchedule: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const interval = Math.max(1, Number(form.get('intervalHours')) || 24);
		const retention = Math.max(1, Number(form.get('retention')) || 7);
		const s3Available = (await getConfigView()).backup.s3Available;
		const destination = form.get('destination') === 's3' && s3Available ? 's3' : 'local';

		await setSetting('backup.auto', form.get('auto') === 'on' ? '1' : null);
		await setSetting('backup.intervalHours', String(interval));
		await setSetting('backup.retention', String(retention));
		await setSetting('backup.destination', destination);
		await rescheduleBackups();
		return { savedSchedule: true };
	},

	deleteBackup: async ({ request, locals }) => {
		requireAdmin(locals);
		const id = String((await request.formData()).get('id') ?? '');
		if (id) await deleteBackup(id);
		return { deleted: true };
	},

	restore: async ({ request, locals }) => {
		requireAdmin(locals);
		const id = String((await request.formData()).get('id') ?? '');
		try {
			await stageRestore(id);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Restore failed.' });
		}
		// Restart so migrate.mjs applies the staged restore at boot (prod: the
		// container's restart policy brings it back on the restored DB).
		const willRestart = process.env.NODE_ENV === 'production';
		if (willRestart) setTimeout(() => process.exit(0), 700);
		return { restoring: true, willRestart };
	}
};
