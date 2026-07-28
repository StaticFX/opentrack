import { error, json } from '@sveltejs/kit';
import { and, count, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { requireProjectAccess } from '$lib/server/access';
import { db, schema } from '$lib/server/db';
import { rateLimit } from '$lib/server/util/ratelimit';
import type { RequestHandler } from './$types';

/**
 * Public search for the project command palette + composer dedupe panel.
 * Anonymous-friendly on public projects; ALWAYS returns public content only
 * (private/archived tickets and non-public suggestions never appear) — members
 * have the internal palette for the full picture.
 */
export const GET: RequestHandler = async ({ params, locals, url, getClientAddress }) => {
	const access = await requireProjectAccess(locals.user, params.projectId);

	const q = (url.searchParams.get('q') ?? '').trim();
	if (q.length < 2) return json({ tickets: [], suggestions: [] });
	if (!rateLimit(`pubsearch:${locals.user?.id ?? getClientAddress()}`, 30, 60_000)) {
		throw error(429, 'Slow down');
	}

	// Ticket titles are only a public surface when the project itself is public.
	const like = `%${q.toLowerCase()}%`;
	const titleCond = sql`lower(${schema.tickets.title}) like ${like}`;
	const num = Number(q.replace(/^#/, ''));
	const ticketMatch =
		Number.isInteger(num) && num > 0 ? or(titleCond, eq(schema.tickets.number, num))! : titleCond;

	const [ticketRows, suggestionRows] = await Promise.all([
		access.visibility === 'public'
			? db
					.select({
						id: schema.tickets.id,
						number: schema.tickets.number,
						title: schema.tickets.title,
						closedAt: schema.tickets.closedAt
					})
					.from(schema.tickets)
					.where(
						and(
							eq(schema.tickets.projectId, params.projectId),
							ne(schema.tickets.visibility, 'private'),
							isNull(schema.tickets.archivedAt),
							ticketMatch
						)
					)
					.orderBy(desc(schema.tickets.createdAt))
					.limit(8)
			: Promise.resolve([]),
		db
			.select({
				id: schema.suggestions.id,
				title: schema.suggestions.title,
				kind: schema.suggestions.kind,
				status: schema.suggestions.status
			})
			.from(schema.suggestions)
			.where(
				and(
					eq(schema.suggestions.projectId, params.projectId),
					eq(schema.suggestions.isPublic, true),
					isNull(schema.suggestions.archivedAt),
					sql`lower(${schema.suggestions.title}) like ${like}`
				)
			)
			.orderBy(desc(schema.suggestions.createdAt))
			.limit(8)
	]);

	// Vote counts so the dedupe panel can show "▲ N" and seed its vote buttons.
	const sIds = suggestionRows.map((r) => r.id);
	const voteRows = sIds.length
		? await db
				.select({ subjectId: schema.votes.subjectId, c: count() })
				.from(schema.votes)
				.where(and(eq(schema.votes.subjectType, 'suggestion'), inArray(schema.votes.subjectId, sIds)))
				.groupBy(schema.votes.subjectId)
		: [];
	const votes = new Map(voteRows.map((r) => [r.subjectId, Number(r.c)]));

	return json({
		tickets: ticketRows.map((t) => ({ ...t, closed: t.closedAt != null })),
		suggestions: suggestionRows.map((s) => ({ ...s, votes: votes.get(s.id) ?? 0 }))
	});
};
