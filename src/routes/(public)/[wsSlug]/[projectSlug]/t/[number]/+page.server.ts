import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { ACCESS, canComment, publicInteractionLocked } from '$lib/server/permissions';
import { listComments } from '$lib/server/services/comments';
import { getTicketDetail } from '$lib/server/services/tickets';
import { hasVoted } from '$lib/server/services/votes';
import { resolveVoter } from '$lib/server/util/anon';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params, locals, cookies, getClientAddress }) => {
	const p = await parent();
	const number = Number(params.number);
	if (!Number.isFinite(number)) throw error(404, 'Not found');

	const [row] = await db
		.select({ id: schema.tickets.id, visibility: schema.tickets.visibility })
		.from(schema.tickets)
		.where(and(eq(schema.tickets.projectId, p.project.id), eq(schema.tickets.number, number)))
		.limit(1);
	if (!row) throw error(404, 'Not found');

	const isPublic = p.effectiveVisibility === 'public' && row.visibility !== 'private';
	if (!isPublic && p.level < ACCESS.VIEWER) throw error(404, 'Not found');

	const [detail, comments] = await Promise.all([
		getTicketDetail(row.id),
		listComments('ticket', row.id)
	]);
	const voter = resolveVoter(locals.user, cookies, getClientAddress);
	const voted = await hasVoted('ticket', row.id, voter);

	const interactionsLocked = publicInteractionLocked(!!detail?.closedAt, p.level);
	return {
		ticket: detail,
		comments,
		voted,
		interactionsLocked,
		canComment:
			!interactionsLocked &&
			canComment(locals.user, p.level, p.effectiveVisibility, p.project.allowPublicComments),
		signedIn: p.signedIn
	};
};
