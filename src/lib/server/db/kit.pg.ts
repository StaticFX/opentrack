import { randomUUID } from 'node:crypto';
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';

/**
 * Postgres column kit. This is the *canonical* dialect: the shared schema in
 * `define.ts` is typed against `Kit = typeof pgKit`, and the SQLite kit is
 * structurally cast to it. Both kits expose the same method names so a single
 * schema definition compiles against either dialect.
 */
export const pgKit = {
	table: pgTable,
	text,
	int: integer,
	bool: boolean,
	ts: (name: string) => timestamp(name, { withTimezone: true, mode: 'date' }),
	json: <T>(name: string) => jsonb(name).$type<T>(),
	uuid: (name: string) => text(name).$defaultFn(() => randomUUID()),
	index,
	uniqueIndex,
	primaryKey,
	check
};

export type Kit = typeof pgKit;
