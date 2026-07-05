import { channels, publish } from './index';

/** Broadcast a board change to all connected viewers (they reconcile by reloading). */
export function boardEvent(
	boardId: string,
	type: string,
	data: Record<string, unknown> = {},
	origin?: string
): Promise<void> {
	return publish(channels.board(boardId), { type, data, origin });
}
