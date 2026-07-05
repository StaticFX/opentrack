// Dependency-free migration runner (plain ESM) so it works in production without
// tsx/TypeScript. Reads config from process.env; loads .env in dev if present.
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

async function main() {
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
