import { error, json } from '@sveltejs/kit';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { enqueueCommentPush } from '$lib/server/github/enqueue';
import { canComment, publicInteractionLocked } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { logActivity } from '$lib/server/services/activity';
import { addComment } from '$lib/server/services/comments';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { access, boardId, closedAt } = await requireTicketAccess(locals.user, params.id);
	// A closed ticket is locked to public commenting (members are unaffected).
	if (publicInteractionLocked(!!closedAt, access.level)) {
		throw error(403, 'This ticket is closed to further public interaction.');
	}
	// Members can always comment; the public only when the project allows it.
	if (!canComment(user, access.level, access.visibility, access.project.allowPublicComments)) {
		throw error(403, 'Comments are not open on this project.');
	}

	const { rateLimit } = await import('$lib/server/util/ratelimit');
	if (!rateLimit(`comment:${user.id}`, 20, 60_000)) throw error(429, 'Slow down');

	const body = await request.json();
	const text = String(body.body ?? '').trim();
	if (!text) throw error(400, 'Comment cannot be empty');

	const id = await addComment('ticket', params.id, user.id, text);
	if (boardId) await boardEvent(boardId, 'ticket.commented', { ticketId: params.id }, user.id);
	await enqueueCommentPush(id, params.id);
	await logActivity({ projectId: access.project.id, subjectType: 'ticket', subjectId: params.id, actorId: user.id, type: 'ticket.commented' });
	return json({ id });
};
