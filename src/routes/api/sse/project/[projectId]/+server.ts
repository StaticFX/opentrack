import { error } from '@sveltejs/kit';
import { requireProjectAccess } from '$lib/server/access';
import { channels } from '$lib/server/realtime';
import { sseResponse } from '$lib/server/realtime/sse';
import { rateLimit } from '$lib/server/util/ratelimit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, request, getClientAddress }) => {
	// Anyone who can view the project can subscribe — anonymous included on
	// public projects (same semantics as the board SSE stream). Connection
	// attempts are rate-limited so a reconnect loop can't pile up streams.
	await requireProjectAccess(locals.user, params.projectId);
	if (!rateLimit(`sse:${locals.user?.id ?? getClientAddress()}`, 20, 60_000)) {
		throw error(429, 'Slow down');
	}
	return sseResponse(channels.project(params.projectId), request.signal);
};
