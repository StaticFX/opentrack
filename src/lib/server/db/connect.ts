import { createClient, type Client as LibsqlClient } from '@libsql/client';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import { drizzle as drizzlePg, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$lib/server/env';
import * as pgSchema from './schema.pg';
import * as sqliteSchema from './schema.sqlite';

/** Canonical schema type — the Postgres tables act as the shared type source. */
export type AppSchema = typeof pgSchema.schema;

/**
 * Uniform database type for the whole app. The libSQL (SQLite) driver is async
 * like postgres-js and its query-builder surface is compatible, so we type it
 * as a Postgres database and cast at construction. Service code must stick to
 * the portable query subset (no `ilike`, no jsonb operators, etc).
 */
export type Database = PostgresJsDatabase<AppSchema>;

export interface DbHandle {
	db: Database;
	schema: AppSchema;
	driver: 'postgres' | 'sqlite';
	/** Underlying client, for LISTEN/NOTIFY (postgres) or raw access. */
	client: postgres.Sql | LibsqlClient;
	close: () => Promise<void>;
}

export function createDb(): DbHandle {
	if (env.databaseDriver === 'sqlite') {
		const client = createClient({ url: env.sqliteUrl, authToken: env.sqliteAuthToken });
		const db = drizzleLibsql(client, { schema: sqliteSchema.schema });
		return {
			db: db as unknown as Database,
			schema: sqliteSchema.schema as unknown as AppSchema,
			driver: 'sqlite',
			client,
			close: async () => client.close()
		};
	}

	const client = postgres(env.databaseUrl, { max: 10 });
	const db = drizzlePg(client, { schema: pgSchema.schema });
	return {
		db,
		schema: pgSchema.schema,
		driver: 'postgres',
		client,
		close: async () => {
			await client.end();
		}
	};
}
