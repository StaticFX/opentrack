import { json } from '@sveltejs/kit';
import { and, desc, eq, ne, or, sql } from 'drizzle-orm';
import { requireProjectAccess } from '$lib/server/access';
import { db, schema } from '$lib/server/db';
import type { RequestHandler } from './$types';

/**
 * Search tickets within a project by number or title (for the relation picker).
 * Portable case-insensitive match via `lower(title) like ?` — no pg-only ilike.
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	await requireProjectAccess(locals.user, params.projectId);

	const q = (url.searchParams.get('q') ?? '').trim();
	const exclude = url.searchParams.get('exclude') ?? '';

	const conds = [eq(schema.tickets.projectId, params.projectId)];
	if (exclude) conds.push(ne(schema.tickets.id, exclude));
	if (q) {
		const like = `%${q.toLowerCase()}%`;
		const textCond = sql`lower(${schema.tickets.title}) like ${like}`;
		const num = Number(q.replace(/^#/, ''));
		conds.push(
			Number.isInteger(num) && num > 0 ? or(textCond, eq(schema.tickets.number, num))! : textCond
		);
	}

	const rows = await db
		.select({
			id: schema.tickets.id,
			number: schema.tickets.number,
			title: schema.tickets.title,
			closedAt: schema.tickets.closedAt
		})
		.from(schema.tickets)
		.where(and(...conds))
		.orderBy(desc(schema.tickets.createdAt))
		.limit(8);

	return json({ tickets: rows });
};
