import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Client as LibsqlClient } from '@libsql/client';
import { desc, eq } from 'drizzle-orm';
import { db, dbClient, dbDriver, schema } from '$lib/server/db';
import { getConfig } from '$lib/server/config';
import { env } from '$lib/server/env';
import { s3DeleteObject, s3GetObject, s3PutObject } from '$lib/server/uploads';

export type BackupRow = typeof schema.backups.$inferSelect;

/** SQLite file header — used to reject anything that isn't a real DB. */
const SQLITE_MAGIC = 'SQLite format 3';

/** On-disk path of the live SQLite database (strip the `file:` URL prefix). */
function dbFilePath(): string {
	return env.sqliteUrl.replace(/^file:/, '');
}
function dataDir(): string {
	return dirname(dbFilePath());
}
/** Directory holding local backup files (on the data volume). */
export function backupsDir(): string {
	return join(dataDir(), 'backups');
}
export function restorePendingPath(): string {
	return join(dataDir(), 'restore-pending.db');
}
export function restoreMarkerPath(): string {
	return join(dataDir(), 'RESTORE_PENDING');
}

export function backupsSupported(): boolean {
	return dbDriver === 'sqlite';
}

function assertSqlite() {
	if (!backupsSupported()) throw new Error('Backups require the SQLite database driver.');
}

function isSqliteBytes(bytes: Buffer): boolean {
	return bytes.length > 100 && bytes.subarray(0, 15).toString('latin1') === SQLITE_MAGIC;
}

/**
 * Take a consistent snapshot of the live database (`VACUUM INTO` — safe while
 * the DB is in use), store it at the configured destination, and record it.
 */
export async function createBackup(kind: 'manual' | 'auto'): Promise<BackupRow> {
	assertSqlite();
	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	const filename = `opentrack-${stamp}-${randomUUID().slice(0, 8)}.db`;
	const tmp = join(dataDir(), `.backup-tmp-${randomUUID()}.db`);

	try {
		await (dbClient as LibsqlClient).execute(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
		const bytes = await readFile(tmp);
		if (!isSqliteBytes(bytes)) throw new Error('Snapshot was not a valid SQLite file');

		const destination = (await getConfig()).backup.destination;
		let storageKey: string;
		if (destination === 's3') {
			storageKey = `backups/${filename}`;
			await s3PutObject(storageKey, bytes, 'application/x-sqlite3');
		} else {
			await mkdir(backupsDir(), { recursive: true });
			await writeFile(join(backupsDir(), filename), bytes);
			storageKey = filename;
		}

		const [row] = await db
			.insert(schema.backups)
			.values({ filename, size: bytes.length, destination, storageKey, kind, status: 'ok' })
			.returning();
		await pruneAuto();
		return row;
	} finally {
		await unlink(tmp).catch(() => {});
	}
}

/** Record a failed backup attempt (for visibility in the admin list). */
export async function recordFailedBackup(kind: 'manual' | 'auto', message: string): Promise<void> {
	await db.insert(schema.backups).values({
		filename: `failed-${new Date().toISOString()}`,
		size: 0,
		destination: (await getConfig()).backup.destination,
		storageKey: '',
		kind,
		status: 'failed',
		error: message.slice(0, 500)
	});
}

export async function listBackups(): Promise<BackupRow[]> {
	return db.select().from(schema.backups).orderBy(desc(schema.backups.createdAt));
}

async function getBackup(id: string): Promise<BackupRow | null> {
	const [row] = await db.select().from(schema.backups).where(eq(schema.backups.id, id)).limit(1);
	return row ?? null;
}

/** Read a backup's bytes from wherever it lives. */
export async function readBackupBytes(row: BackupRow): Promise<Buffer> {
	if (row.destination === 's3') return s3GetObject(row.storageKey);
	return readFile(join(backupsDir(), row.storageKey));
}

export async function deleteBackup(id: string): Promise<void> {
	const row = await getBackup(id);
	if (!row) return;
	if (row.status === 'ok') {
		if (row.destination === 's3') await s3DeleteObject(row.storageKey).catch(() => {});
		else await unlink(join(backupsDir(), row.storageKey)).catch(() => {});
	}
	await db.delete(schema.backups).where(eq(schema.backups.id, id));
}

/** Keep only the newest `retention` successful automatic backups. */
async function pruneAuto(): Promise<void> {
	const retention = (await getConfig()).backup.retention;
	const autos = (await listBackups()).filter((b) => b.kind === 'auto' && b.status === 'ok');
	for (const b of autos.slice(retention)) await deleteBackup(b.id);
}

/**
 * Stage a backup to be restored on the next boot. The actual file swap happens
 * in `scripts/migrate.mjs` BEFORE the app opens the DB — the only safe moment.
 * Returns after staging; the caller is responsible for restarting the process.
 */
export async function stageRestore(id: string): Promise<BackupRow> {
	assertSqlite();
	const row = await getBackup(id);
	if (!row || row.status !== 'ok') throw new Error('Backup not found');
	const bytes = await readBackupBytes(row);
	if (!isSqliteBytes(bytes)) throw new Error('Backup file is not a valid SQLite database');
	await writeFile(restorePendingPath(), bytes);
	await writeFile(restoreMarkerPath(), row.filename);
	return row;
}
