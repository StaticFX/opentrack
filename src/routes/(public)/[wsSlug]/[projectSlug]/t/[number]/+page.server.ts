import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { ACCESS, canComment, publicInteractionLocked } from '$lib/server/permissions';
import { listComments } from '$lib/server/services/comments';
import { isWatching } from '$lib/server/services/notifications';
import { summarize } from '$lib/server/services/reactions';
import { releaseForTicket } from '$lib/server/services/releases';
import { getTicketDetail } from '$lib/server/services/tickets';
import { countVotes, hasVoted } from '$lib/server/services/votes';
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

	const voter = resolveVoter(locals.user, cookies, getClientAddress);
	const uid = locals.user?.id;
	const [detail, comments, voted, reactions, watching, release, originRow] = await Promise.all([
		getTicketDetail(row.id),
		listComments('ticket', row.id),
		hasVoted('ticket', row.id, voter),
		summarize('ticket', row.id, uid),
		uid ? isWatching('ticket', row.id, uid) : Promise.resolve(false),
		releaseForTicket(row.id),
		// The community suggestion this ticket was born from, if any.
		db
			.select({
				id: schema.suggestions.id,
				title: schema.suggestions.title,
				isPublic: schema.suggestions.isPublic,
				archivedAt: schema.suggestions.archivedAt
			})
			.from(schema.suggestions)
			.where(eq(schema.suggestions.convertedTicketId, row.id))
			.limit(1)
	]);

	// Resolve the ticket's current column for the "Currently in" fact.
	let column: { name: string; category: string } | null = null;
	if (detail?.columnId) {
		const [col] = await db
			.select({ name: schema.boardColumns.name, category: schema.boardColumns.category })
			.from(schema.boardColumns)
			.where(eq(schema.boardColumns.id, detail.columnId))
			.limit(1);
		column = col ?? null;
	}

	const origin = originRow[0];
	const originSuggestion =
		origin && ((origin.isPublic && origin.archivedAt == null) || p.level >= ACCESS.VIEWER)
			? { id: origin.id, title: origin.title, votes: await countVotes('suggestion', origin.id) }
			: null;

	const interactionsLocked = publicInteractionLocked(!!detail?.closedAt, p.level);
	return {
		ticket: detail,
		column,
		release,
		originSuggestion,
		ticketReactions: reactions,
		watching,
		comments,
		voted,
		interactionsLocked,
		canComment:
			!interactionsLocked &&
			canComment(locals.user, p.level, p.effectiveVisibility, p.project.allowPublicComments),
		signedIn: p.signedIn
	};
};
