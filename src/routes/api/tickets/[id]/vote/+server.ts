import { error, json } from '@sveltejs/kit';
import { requireTicketAccess } from '$lib/server/access';
import { publicInteractionLocked } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { resolveVoter } from '$lib/server/util/anon';
import { rateLimit } from '$lib/server/util/ratelimit';
import { toggleVote } from '$lib/server/services/votes';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, cookies, getClientAddress }) => {
	// Viewing access is enough to vote; private tickets are hidden from anon (404).
	const { boardId, access, closedAt } = await requireTicketAccess(locals.user, params.id);
	// Once closed by a maintainer, the ticket is locked to public interaction.
	if (publicInteractionLocked(!!closedAt, access.level)) {
		throw error(403, 'This ticket is closed to further public interaction.');
	}
	const voter = resolveVoter(locals.user, cookies, getClientAddress);
	if (!rateLimit(`vote:${voter.userId ?? voter.anonKey}`, 40, 60_000)) throw error(429, 'Slow down');
	const result = await toggleVote('ticket', params.id, voter);
	if (boardId) await boardEvent(boardId, 'ticket.voted', { ticketId: params.id }, locals.user?.id);
	return json(result);
};
