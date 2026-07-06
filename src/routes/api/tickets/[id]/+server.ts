import { error, json } from '@sveltejs/kit';
import type { Priority } from '$lib/constants';
import { PRIORITIES } from '$lib/constants';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { enqueueIssueCloseForTicket, enqueueTicketPush } from '$lib/server/github/enqueue';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import { listChecklist } from '$lib/server/services/checklists';
import { listComments } from '$lib/server/services/comments';
import { getTicketFields } from '$lib/server/services/custom-fields';
import { isWatching, notifyWatchers } from '$lib/server/services/notifications';
import { reactionsFor, summarize } from '$lib/server/services/reactions';
import { deleteTicket, getTicketDetail, updateTicket } from '$lib/server/services/tickets';
import { hasVoted } from '$lib/server/services/votes';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { access } = await requireTicketAccess(locals.user, params.id);
	const detail = await getTicketDetail(params.id);
	if (!detail) throw error(404, 'Ticket not found');
	const comments = await listComments('ticket', params.id);
	const voted = locals.user ? await hasVoted('ticket', params.id, { userId: locals.user.id }) : false;
	const watching = locals.user ? await isWatching('ticket', params.id, locals.user.id) : false;
	// Reactions: ticket-level + a batch for its comments.
	const uid = locals.user?.id;
	const ticketReactions = await summarize('ticket', params.id, uid);
	const commentReactions = await reactionsFor('comment', comments.map((c) => c.id), uid);
	const commentsWithReactions = comments.map((c) => ({ ...c, reactions: commentReactions.get(c.id) ?? [] }));
	const checklist = await listChecklist(params.id);
	const fields = await getTicketFields(params.id, access.project.id);
	return json({
		ticket: detail,
		comments: commentsWithReactions,
		reactions: ticketReactions,
		checklist,
		fields,
		voted,
		watching,
		access: {
			level: access.level,
			canEdit: access.level >= ACCESS.COLLABORATOR,
			canManage: access.level >= ACCESS.MAINTAINER
		}
	});
};

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { boardId } = await requireTicketAccess(locals.user, params.id, ACCESS.COLLABORATOR);
	const body = await request.json();

	// Track which fields actually changed so we can describe the update.
	const changed: string[] = [];
	if (typeof body.title === 'string') changed.push('title');
	if (body.description !== undefined) changed.push('description');
	if (PRIORITIES.includes(body.priority)) changed.push('priority');
	if (body.dueDate !== undefined) changed.push('due date');

	await updateTicket(params.id, {
		...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
		...(body.description !== undefined ? { description: body.description || null } : {}),
		...(PRIORITIES.includes(body.priority) ? { priority: body.priority as Priority } : {}),
		...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {})
	});
	if (boardId) await boardEvent(boardId, 'ticket.updated', { ticketId: params.id }, user.id);
	await enqueueTicketPush(params.id);

	// Let watchers know the ticket changed (skips the actor + never throws).
	if (changed.length) {
		const what = changed.length === 1 ? `the ${changed[0]}` : 'this ticket';
		await notifyWatchers({
			type: 'ticket.updated',
			subjectType: 'ticket',
			subjectId: params.id,
			actorId: user.id,
			body: `${user.displayName} updated ${what}`
		});
	}
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals.user);
	const { boardId } = await requireTicketAccess(locals.user, params.id, ACCESS.MAINTAINER);
	// Close the linked GitHub issue first — capture its coordinates before the row is gone.
	await enqueueIssueCloseForTicket(params.id);
	await deleteTicket(params.id);
	if (boardId) await boardEvent(boardId, 'ticket.deleted', { ticketId: params.id }, user.id);
	return json({ ok: true });
};
