import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import type { SessionUser } from '$lib/server/auth/session';
import { db, schema } from '$lib/server/db';

export interface SearchProject {
	name: string;
	slug: string;
	wsSlug: string;
	color: string | null;
	icon: string | null;
}
export interface SearchTicket {
	number: number;
	title: string;
	slug: string;
	wsSlug: string;
	closed: boolean;
}
export interface SearchResults {
	projects: SearchProject[];
	tickets: SearchTicket[];
}

/**
 * Project ids the user can see: any project in a workspace they belong to or
 * own, plus direct project memberships. Keeps the command palette from leaking
 * private projects.
 */
async function accessibleProjectIds(user: SessionUser): Promise<string[]> {
	const [wsMember, wsOwned, projMember] = await Promise.all([
		db
			.select({ id: schema.workspaceMembers.workspaceId })
			.from(schema.workspaceMembers)
			.where(eq(schema.workspaceMembers.userId, user.id)),
		db.select({ id: schema.workspaces.id }).from(schema.workspaces).where(eq(schema.workspaces.ownerId, user.id)),
		db
			.select({ id: schema.projectMembers.projectId })
			.from(schema.projectMembers)
			.where(eq(schema.projectMembers.userId, user.id))
	]);
	const wsIds = [...new Set([...wsMember.map((r) => r.id), ...wsOwned.map((r) => r.id)])];
	const ids = new Set<string>(projMember.map((r) => r.id));
	if (wsIds.length) {
		const rows = await db
			.select({ id: schema.projects.id })
			.from(schema.projects)
			.where(inArray(schema.projects.workspaceId, wsIds));
		for (const r of rows) ids.add(r.id);
	}
	return [...ids];
}

/** Cross-project fuzzy search over projects + tickets (command palette). */
export async function globalSearch(user: SessionUser, q: string): Promise<SearchResults> {
	const term = q.trim().toLowerCase();
	if (!term) return { projects: [], tickets: [] };
	const projectIds = await accessibleProjectIds(user);
	if (!projectIds.length) return { projects: [], tickets: [] };
	const like = `%${term}%`;

	const projRows = await db
		.select({
			name: schema.projects.name,
			slug: schema.projects.slug,
			color: schema.projects.color,
			icon: schema.projects.icon,
			wsSlug: schema.workspaces.slug
		})
		.from(schema.projects)
		.innerJoin(schema.workspaces, eq(schema.projects.workspaceId, schema.workspaces.id))
		.where(and(inArray(schema.projects.id, projectIds), sql`lower(${schema.projects.name}) like ${like}`))
		.limit(6);

	const num = Number(term.replace(/^#/, ''));
	const titleCond = sql`lower(${schema.tickets.title}) like ${like}`;
	const ticketCond =
		Number.isInteger(num) && num > 0 ? or(titleCond, eq(schema.tickets.number, num))! : titleCond;
	const ticketRows = await db
		.select({
			number: schema.tickets.number,
			title: schema.tickets.title,
			closedAt: schema.tickets.closedAt,
			slug: schema.projects.slug,
			wsSlug: schema.workspaces.slug
		})
		.from(schema.tickets)
		.innerJoin(schema.projects, eq(schema.tickets.projectId, schema.projects.id))
		.innerJoin(schema.workspaces, eq(schema.projects.workspaceId, schema.workspaces.id))
		.where(and(inArray(schema.tickets.projectId, projectIds), ticketCond))
		.orderBy(desc(schema.tickets.createdAt))
		.limit(8);

	return {
		projects: projRows,
		tickets: ticketRows.map((r) => ({
			number: r.number,
			title: r.title,
			slug: r.slug,
			wsSlug: r.wsSlug,
			closed: !!r.closedAt
		}))
	};
}
