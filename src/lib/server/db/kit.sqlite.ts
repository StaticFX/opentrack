import { randomUUID } from 'node:crypto';
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import type { Kit } from './kit.pg';

/**
 * SQLite column kit — same method names as the Postgres kit so the shared
 * schema in `define.ts` builds against either dialect. Differences:
 *   - booleans stored as integers (mode: 'boolean')
 *   - timestamps stored as epoch-ms integers (mode: 'timestamp_ms')
 *   - json stored as text (mode: 'json')
 * Cast to `Kit` because the underlying builder types differ, but the produced
 * columns are structurally equivalent (both surface Date / boolean / T).
 */
export const sqliteKit = {
	table: sqliteTable,
	text,
	int: integer,
	bool: (name: string) => integer(name, { mode: 'boolean' }),
	ts: (name: string) => integer(name, { mode: 'timestamp_ms' }),
	json: <T>(name: string) => text(name, { mode: 'json' }).$type<T>(),
	uuid: (name: string) => text(name).$defaultFn(() => randomUUID()),
	index,
	uniqueIndex,
	primaryKey,
	check
} as unknown as Kit;
