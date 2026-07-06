import { createPubSub, type PubSub } from './pubsub';

const globalForPubSub = globalThis as unknown as { __otPubSub?: PubSub };

export const pubsub: PubSub = globalForPubSub.__otPubSub ?? createPubSub();
if (!globalForPubSub.__otPubSub) globalForPubSub.__otPubSub = pubsub;

/** Channel name helpers — keep channel strings consistent across producers/consumers. */
export const channels = {
	board: (boardId: string) => `board:${boardId}`,
	ticket: (ticketId: string) => `ticket:${ticketId}`,
	project: (projectId: string) => `project:${projectId}`,
	suggestions: (projectId: string) => `suggestions:${projectId}`,
	/** Per-user channel for the notification inbox (SSE-driven live badge). */
	user: (userId: string) => `user:${userId}`
};

export type RealtimeEvent<T = unknown> = {
	type: string;
	data: T;
	/** Optional origin id so clients can ignore echoes of their own optimistic actions. */
	origin?: string;
};

export function publish<T>(channel: string, event: RealtimeEvent<T>): Promise<void> {
	return pubsub.publish(channel, event);
}
