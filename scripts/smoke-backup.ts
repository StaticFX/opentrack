// Verify the backup/restore system end to end. Two phases around a real reboot:
//   stage  → create backups, exercise retention, stage a restore
//   verify → (run after `node scripts/migrate.mjs`) confirm the DB was swapped
import '$lib/server/load-env';
import { existsSync, readdirSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { setSetting, invalidateConfig } from '$lib/server/config';
import { closeDb, db, schema } from '$lib/server/db';
import {
	backupsDir,
	createBackup,
	listBackups,
	restoreMarkerPath,
	restorePendingPath,
	stageRestore
} from '$lib/server/backup/service';

function assert(c: unknown, m: string) {
	if (!c) throw new Error('FAIL: ' + m);
	console.log('  ✓ ' + m);
}
async function marker(): Promise<string | undefined> {
	const [r] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'test.marker')).limit(1);
	return r?.value ?? undefined;
}

async function stage() {
	console.log('[stage] create + retention + stage restore');
	await db.delete(schema.backups);
	await setSetting('backup.destination', 'local');
	await setSetting('backup.retention', '2');
	invalidateConfig();

	// Snapshot A captures marker=A.
	await setSetting('test.marker', 'A');
	const a = await createBackup('manual');
	assert(existsSync(`${backupsDir()}/${a.storageKey}`) && a.size > 0, 'backup A written to disk with non-zero size');

	// Two more auto backups → retention(2) should prune to 2 autos.
	await createBackup('auto');
	await createBackup('auto');
	await createBackup('auto');
	const autos = (await listBackups()).filter((b) => b.kind === 'auto' && b.status === 'ok');
	assert(autos.length === 2, `retention kept newest 2 auto backups (got ${autos.length})`);

	// Change the DB, then stage a restore back to A.
	await setSetting('test.marker', 'B');
	assert((await marker()) === 'B', 'marker is B before restore');
	const staged = await stageRestore(a.id);
	assert(existsSync(restorePendingPath()) && existsSync(restoreMarkerPath()), 'restore staged (pending file + marker present)');
	console.log(`  → staged restore of ${staged.filename}`);
	await closeDb();
}

async function verify() {
	console.log('[verify] after reboot swap');
	assert((await marker()) === 'A', 'database was restored to snapshot A (marker=A, not B)');
	assert(!existsSync(restorePendingPath()) && !existsSync(restoreMarkerPath()), 'restore staging files cleaned up');
	const preRestore = readdirSync(backupsDir() + '/..').filter((n) => n.startsWith('pre-restore-'));
	assert(preRestore.length >= 1, 'pre-restore safety copy of the previous DB was made');
	console.log('\n✅ smoke-backup passed');
	await closeDb();
}

const mode = process.argv[2];
(mode === 'verify' ? verify() : stage()).catch(async (err) => {
	console.error('\n❌ smoke-backup failed:', err);
	await closeDb();
	process.exit(1);
});
