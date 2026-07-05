import { createDb, type DbHandle } from './connect';

// Single shared connection for the process (app runtime or a tsx script).
// Guarded on globalThis so HMR in dev doesn't open a new pool on every reload.
const globalForDb = globalThis as unknown as { __otDb?: DbHandle };

const handle: DbHandle = globalForDb.__otDb ?? createDb();
if (!globalForDb.__otDb) globalForDb.__otDb = handle;

export const db = handle.db;
export const schema = handle.schema;
export const dbDriver = handle.driver;
export const dbClient = handle.client;
export const closeDb = handle.close;

export type { Database, AppSchema } from './connect';

/** The transaction executor type (same query surface as `db`). */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
