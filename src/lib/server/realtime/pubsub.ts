import { EventEmitter } from 'node:events';
import type { Sql } from 'postgres';
import { dbClient, dbDriver } from '$lib/server/db';
import { env } from '$lib/server/env';

export type PubSubHandler = (payload: unknown) => void;

export interface PubSub {
	publish(channel: string, payload: unknown): Promise<void>;
	subscribe(channel: string, handler: PubSubHandler): () => void;
	close(): Promise<void>;
}

/** In-process pub/sub — correct for single-instance deploys (incl. SQLite). */
class MemoryPubSub implements PubSub {
	private emitter = new EventEmitter();

	constructor() {
		// Boards can have many concurrent SSE listeners.
		this.emitter.setMaxListeners(0);
	}

	async publish(channel: string, payload: unknown): Promise<void> {
		this.emitter.emit(channel, payload);
	}

	subscribe(channel: string, handler: PubSubHandler): () => void {
		this.emitter.on(channel, handler);
		return () => this.emitter.off(channel, handler);
	}

	async close(): Promise<void> {
		this.emitter.removeAllListeners();
	}
}

/**
 * Postgres LISTEN/NOTIFY pub/sub — cross-instance delivery for multi-replica
 * deploys. All logical channels are multiplexed over a single Postgres channel
 * (`opentrack`) with the logical channel carried in the payload, avoiding one
 * LISTEN per board.
 */
const PG_CHANNEL = 'opentrack';

class PostgresPubSub implements PubSub {
	private emitter = new EventEmitter();
	private ready: Promise<void>;

	constructor(private sql: Sql) {
		this.emitter.setMaxListeners(0);
		this.ready = this.sql
			.listen(PG_CHANNEL, (raw) => {
				try {
					const { channel, payload } = JSON.parse(raw) as { channel: string; payload: unknown };
					this.emitter.emit(channel, payload);
				} catch {
					/* ignore malformed notifications */
				}
			})
			.then(() => undefined);
	}

	async publish(channel: string, payload: unknown): Promise<void> {
		// Delivered back to us via LISTEN, so local + remote subscribers share one path.
		await this.sql.notify(PG_CHANNEL, JSON.stringify({ channel, payload }));
	}

	subscribe(channel: string, handler: PubSubHandler): () => void {
		void this.ready;
		this.emitter.on(channel, handler);
		return () => this.emitter.off(channel, handler);
	}

	async close(): Promise<void> {
		this.emitter.removeAllListeners();
	}
}

export function createPubSub(): PubSub {
	if (env.pubsubDriver === 'postgres' && dbDriver === 'postgres') {
		return new PostgresPubSub(dbClient as Sql);
	}
	if (env.pubsubDriver === 'postgres') {
		console.warn('[pubsub] PUBSUB_DRIVER=postgres requires DATABASE_DRIVER=postgres; using memory.');
	}
	return new MemoryPubSub();
}
