import { defineConfig } from 'drizzle-kit';

// Pick dialect from DATABASE_DRIVER so `db:generate`/`db:push` target the right
// schema file and migration folder. Migrations live in per-dialect folders.
const isSqlite = process.env.DATABASE_DRIVER === 'sqlite';

export default isSqlite
	? defineConfig({
			dialect: 'sqlite',
			schema: './src/lib/server/db/schema.sqlite.ts',
			out: './drizzle/sqlite',
			dbCredentials: { url: process.env.SQLITE_URL ?? 'file:./data/opentrack.db' }
		})
	: defineConfig({
			dialect: 'postgresql',
			schema: './src/lib/server/db/schema.pg.ts',
			out: './drizzle/pg',
			dbCredentials: { url: process.env.DATABASE_URL ?? '' }
		});
