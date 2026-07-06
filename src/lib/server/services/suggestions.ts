import { and, asc, count, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { SuggestionStatus } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { createTicket } from './tickets';
import { votedSubjects, type VoterKey } from './votes';

export type SuggestionSort = 'top' | 'new' | 'trending';

export interface SuggestionCard {
	id: string;
	title: string;
	body: string | null;
	status: SuggestionStatus;
	authorName: string | null;
	createdAt: Date;
	votes: number;
	comments: number;
	convertedTicketId: string | null;
}

export interface ListOptions {
	status?: SuggestionStatus | 'all';
	sort?: SuggestionSort;
	publicOnly?: boolean;
	voter?: VoterKey;
}

/** List suggestions for a project with vote/comment counts, sorted & filtered. */
export async function listSuggestions(
	projectId: string,
	opts: ListOptions = {}
): Promise<{ cards: SuggestionCard[]; votedIds: Set<string> }> {
	const filters = [eq(schema.suggestions.projectId, projectId)];
	if (opts.publicOnly) filters.push(eq(schema.suggestions.isPublic, true));
	if (opts.status && opts.status !== 'all') filters.push(eq(schema.suggestions.status, opts.status));

	const rows = await db
		.select({ suggestion: schema.suggestions, authorName: schema.users.displayName })
		.from(schema.suggestions)
		.leftJoin(schema.users, eq(schema.suggestions.authorId, schema.users.id))
		.where(and(...filters));
	if (rows.length === 0) return { cards: [], votedIds: new Set() };

	const ids = rows.map((r) => r.suggestion.id);
	const [voteRows, commentRows] = await Promise.all([
		db
			.select({ subjectId: schema.votes.subjectId, c: count() })
			.from(schema.votes)
			.where(and(eq(schema.votes.subjectType, 'suggestion'), inArray(schema.votes.subjectId, ids)))
			.groupBy(schema.votes.subjectId),
		db
			.select({ subjectId: schema.comments.subjectId, c: count() })
			.from(schema.comments)
			.where(and(eq(schema.comments.subjectType, 'suggestion'), inArray(schema.comments.subjectId, ids)))
			.groupBy(schema.comments.subjectId)
	]);
	const votesById = new Map(voteRows.map((r) => [r.subjectId, Number(r.c)]));
	const commentsById = new Map(commentRows.map((r) => [r.subjectId, Number(r.c)]));

	let cards: SuggestionCard[] = rows.map((r) => ({
		id: r.suggestion.id,
		title: r.suggestion.title,
		body: r.suggestion.body,
		status: r.suggestion.status,
		authorName: r.authorName,
		createdAt: r.suggestion.createdAt,
		votes: votesById.get(r.suggestion.id) ?? 0,
		comments: commentsById.get(r.suggestion.id) ?? 0,
		convertedTicketId: r.suggestion.convertedTicketId
	}));

	const sort = opts.sort ?? 'top';
	const now = Date.now();
	if (sort === 'new') cards.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	else if (sort === 'trending') {
		const score = (c: SuggestionCard) => {
			const ageHours = (now - c.createdAt.getTime()) / 3_600_000;
			return (c.votes + 1) / Math.pow(ageHours + 2, 1.5);
		};
		cards.sort((a, b) => score(b) - score(a));
	} else cards.sort((a, b) => b.votes - a.votes || b.createdAt.getTime() - a.createdAt.getTime());

	const votedIds = opts.voter ? await votedSubjects('suggestion', opts.voter) : new Set<string>();
	return { cards, votedIds };
}

export async function getSuggestion(id: string) {
	const [row] = await db
		.select({
			suggestion: schema.suggestions,
			authorName: schema.users.displayName,
			authorUsername: schema.users.username
		})
		.from(schema.suggestions)
		.leftJoin(schema.users, eq(schema.suggestions.authorId, schema.users.id))
		.where(eq(schema.suggestions.id, id))
		.limit(1);
	if (!row) return null;
	let duplicateOfTitle: string | null = null;
	if (row.suggestion.duplicateOfId) {
		const [t] = await db
			.select({ title: schema.suggestions.title })
			.from(schema.suggestions)
			.where(eq(schema.suggestions.id, row.suggestion.duplicateOfId))
			.limit(1);
		duplicateOfTitle = t?.title ?? null;
	}
	return { ...row.suggestion, authorName: row.authorName, authorUsername: row.authorUsername, duplicateOfTitle };
}

export async function createSuggestion(
	user: SessionUser,
	projectId: string,
	input: { title: string; body?: string }
): Promise<string> {
	const [row] = await db
		.insert(schema.suggestions)
		.values({ projectId, authorId: user.id, title: input.title, body: input.body ?? null })
		.returning({ id: schema.suggestions.id });
	return row.id;
}

export async function setStatus(
	id: string,
	status: SuggestionStatus,
	declineReason?: string | null
): Promise<void> {
	await db
		.update(schema.suggestions)
		.set({ status, declineReason: declineReason ?? null, updatedAt: new Date() })
		.where(eq(schema.suggestions.id, id));
}

/** Search a project's suggestions by title (for the merge picker). */
export async function searchSuggestions(
	projectId: string,
	q: string,
	excludeId?: string
): Promise<Array<{ id: string; title: string; status: SuggestionStatus }>> {
	const conds = [eq(schema.suggestions.projectId, projectId)];
	if (excludeId) conds.push(ne(schema.suggestions.id, excludeId));
	const term = q.trim().toLowerCase();
	if (term) conds.push(sql`lower(${schema.suggestions.title}) like ${`%${term}%`}`);
	return db
		.select({ id: schema.suggestions.id, title: schema.suggestions.title, status: schema.suggestions.status })
		.from(schema.suggestions)
		.where(and(...conds))
		.orderBy(desc(schema.suggestions.createdAt))
		.limit(8);
}

/**
 * Merge `sourceId` into `targetId` as a duplicate: transfers votes + watchers
 * (deduped), marks the source `duplicate`, and records the canonical target.
 * Returns the two titles, or null if the merge is invalid.
 */
export async function mergeSuggestion(
	sourceId: string,
	targetId: string
): Promise<{ sourceTitle: string; targetTitle: string } | null> {
	if (sourceId === targetId) return null;
	const [source, target] = await Promise.all([getSuggestion(sourceId), getSuggestion(targetId)]);
	if (!source || !target || source.projectId !== target.projectId) return null;

	// Transfer votes (unique indexes dedupe voters already on the target).
	const votes = await db
		.select({ userId: schema.votes.userId, anonKey: schema.votes.anonKey })
		.from(schema.votes)
		.where(and(eq(schema.votes.subjectType, 'suggestion'), eq(schema.votes.subjectId, sourceId)));
	for (const v of votes) {
		await db
			.insert(schema.votes)
			.values({ subjectType: 'suggestion', subjectId: targetId, userId: v.userId, anonKey: v.anonKey })
			.onConflictDoNothing();
	}

	// Transfer watchers.
	const watchers = await db
		.select({ userId: schema.watchers.userId })
		.from(schema.watchers)
		.where(and(eq(schema.watchers.subjectType, 'suggestion'), eq(schema.watchers.subjectId, sourceId)));
	for (const w of watchers) {
		await db
			.insert(schema.watchers)
			.values({ subjectType: 'suggestion', subjectId: targetId, userId: w.userId, reason: 'manual' })
			.onConflictDoNothing();
	}

	await db
		.update(schema.suggestions)
		.set({ status: 'duplicate', duplicateOfId: targetId, updatedAt: new Date() })
		.where(eq(schema.suggestions.id, sourceId));

	return { sourceTitle: source.title, targetTitle: target.title };
}

/** Convert a suggestion into a ticket in the project's first board. */
export async function convertToTicket(
	actor: SessionUser,
	suggestionId: string
): Promise<{ ticketId: string; boardId: string } | null> {
	const suggestion = await getSuggestion(suggestionId);
	if (!suggestion) return null;
	if (suggestion.convertedTicketId) {
		const [b] = await db
			.select({ boardId: schema.tickets.boardId })
			.from(schema.tickets)
			.where(eq(schema.tickets.id, suggestion.convertedTicketId))
			.limit(1);
		return { ticketId: suggestion.convertedTicketId, boardId: b?.boardId ?? '' };
	}

	const [board] = await db
		.select({ id: schema.boards.id })
		.from(schema.boards)
		.where(eq(schema.boards.projectId, suggestion.projectId))
		.orderBy(asc(schema.boards.position))
		.limit(1);
	if (!board) return null;
	// Prefer a backlog/todo column, else the first.
	const cols = await db
		.select({ id: schema.boardColumns.id, category: schema.boardColumns.category })
		.from(schema.boardColumns)
		.where(eq(schema.boardColumns.boardId, board.id))
		.orderBy(asc(schema.boardColumns.position));
	const column = cols.find((c) => c.category === 'backlog') ?? cols.find((c) => c.category === 'todo') ?? cols[0];
	if (!column) return null;

	const ticket = await createTicket(actor, {
		projectId: suggestion.projectId,
		boardId: board.id,
		columnId: column.id,
		title: suggestion.title,
		description: suggestion.body ?? undefined
	});
	await db
		.update(schema.suggestions)
		.set({ status: 'converted', convertedTicketId: ticket.id, updatedAt: new Date() })
		.where(eq(schema.suggestions.id, suggestionId));

	return { ticketId: ticket.id, boardId: board.id };
}
