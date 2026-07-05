import { requireBoardAccess } from '$lib/server/access';
import { channels } from '$lib/server/realtime';
import { sseResponse } from '$lib/server/realtime/sse';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, request }) => {
	// Anyone who can view the board can subscribe to its live updates.
	await requireBoardAccess(locals.user, params.boardId);
	return sseResponse(channels.board(params.boardId), request.signal);
};
