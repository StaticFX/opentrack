// Dependency-free migration runner (plain ESM) so it works in production without
// tsx/TypeScript. Reads config from process.env; loads .env in dev if present.
import { copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import { migrate as migrateLibsql } from 'drizzle-orm/libsql/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

try {
	process.loadEnvFile();
} catch {
	// no .env; use real environment
}

const driver = process.env.DATABASE_DRIVER === 'sqlite' ? 'sqlite' : 'postgres';

/**
 * If a restore was staged (Admin → Backups), swap the pending snapshot over the
 * live DB here — BEFORE anything opens it — which is the only safe moment. The
 * current DB is copied aside first, and the pending file is validated, so a bad
 * restore can't brick the instance.
 */
function applyPendingRestore() {
	if (driver !== 'sqlite') return;
	const dbPath = (process.env.SQLITE_URL ?? 'file:./data/opentrack.db').replace(/^file:/, '');
	const dir = dirname(dbPath);
	const marker = join(dir, 'RESTORE_PENDING');
	const pending = join(dir, 'restore-pending.db');
	if (!existsSync(marker) || !existsSync(pending)) return;

	const bytes = readFileSync(pending);
	const valid = bytes.length > 100 && bytes.subarray(0, 15).toString('latin1') === 'SQLite format 3';
	if (!valid) {
		console.error('[restore] staged file is not a valid SQLite DB — aborting restore');
		rmSync(marker, { force: true });
		rmSync(pending, { force: true });
		return;
	}
	if (existsSync(dbPath)) {
		const stamp = new Date().toISOString().replace(/[:.]/g, '-');
		copyFileSync(dbPath, join(dir, `pre-restore-${stamp}.db`));
	}
	copyFileSync(pending, dbPath);
	// Drop stale WAL/SHM so the restored file is authoritative.
	rmSync(`${dbPath}-wal`, { force: true });
	rmSync(`${dbPath}-shm`, { force: true });
	rmSync(marker, { force: true });
	rmSync(pending, { force: true });
	console.log('[restore] restored database from staged backup');
}

async function main() {
	applyPendingRestore();
	if (driver === 'sqlite') {
		const client = createClient({
			url: process.env.SQLITE_URL ?? 'file:./data/opentrack.db',
			authToken: process.env.SQLITE_AUTH_TOKEN || undefined
		});
		const db = drizzleLibsql(client);
		await migrateLibsql(db, { migrationsFolder: './drizzle/sqlite' });
		client.close();
		console.log('[migrate] sqlite migrations applied');
	} else {
		const url = process.env.DATABASE_URL;
		if (!url) throw new Error('DATABASE_URL is required for postgres');
		const client = postgres(url, { max: 1 });
		const db = drizzlePg(client);
		await migratePg(db, { migrationsFolder: './drizzle/pg' });
		await client.end();
		console.log('[migrate] postgres migrations applied');
	}
}

main().catch((err) => {
	console.error('[migrate] failed:', err);
	process.exit(1);
});
