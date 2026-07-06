import { requireUser } from '$lib/server/access';
import { channels } from '$lib/server/realtime';
import { sseResponse } from '$lib/server/realtime/sse';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, request }) => {
	const user = requireUser(locals.user);
	return sseResponse(channels.user(user.id), request.signal);
};
