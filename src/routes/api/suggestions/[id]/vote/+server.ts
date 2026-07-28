import { error, json } from '@sveltejs/kit';
import { requireSuggestionAccess } from '$lib/server/access';
import { publicInteractionLocked } from '$lib/server/permissions';
import { resolveVoter } from '$lib/server/util/anon';
import { rateLimit } from '$lib/server/util/ratelimit';
import { toggleVote } from '$lib/server/services/votes';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, cookies, getClientAddress }) => {
	// Viewing access is enough to upvote; anonymous voters are allowed.
	const { access, status } = await requireSuggestionAccess(locals.user, params.id);
	// Once triaged (resolved), the suggestion is locked to public interaction.
	if (publicInteractionLocked(status !== 'open', access.level)) {
		throw error(403, 'This suggestion has been resolved and is closed to further votes.');
	}
	const voter = resolveVoter(locals.user, cookies, getClientAddress);
	if (!rateLimit(`vote:${voter.userId ?? voter.anonKey}`, 40, 60_000)) throw error(429, 'Slow down');
	const result = await toggleVote('suggestion', params.id, voter);
	// Best-effort live signal — a publish failure must not 500 a committed vote.
	const { projectEvent } = await import('$lib/server/realtime/project');
	void projectEvent(access.project.id, 'suggestion.voted', { suggestionId: params.id }, locals.user?.id).catch(() => {});
	return json(result);
};
