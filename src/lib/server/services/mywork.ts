import { and, asc, desc, eq, inArray, isNull, lte } from 'drizzle-orm';
import type { SessionUser } from '$lib/server/auth/session';
import { db, schema } from '$lib/server/db';
import { accessibleProjectIds } from './search';

/** A ticket row shaped for the cross-project "My Work" lists. */
export interface MyTicket {
	id: string;
	number: number;
	title: string;
	priority: string;
	closed: boolean;
	dueDate: Date | null;
	wsSlug: string;
	projSlug: string;
	projName: string;
	projColor: string | null;
	/** Public ticket deep link, consistent with search + notifications. */
	url: string;
}

const DAY_MS = 86_400_000;

/** Shared select shape for ticket → project → workspace joins. */
const ticketCols = {
	id: schema.tickets.id,
	number: schema.tickets.number,
	title: schema.tickets.title,
	priority: schema.tickets.priority,
	closedAt: schema.tickets.closedAt,
	dueDate: schema.tickets.dueDate,
	projSlug: schema.projects.slug,
	projName: schema.projects.name,
	projColor: schema.projects.color,
	wsSlug: schema.workspaces.slug
};

function toMyTicket(r: {
	id: string;
	number: number;
	title: string;
	priority: string;
	closedAt: Date | null;
	dueDate: Date | null;
	projSlug: string;
	projName: string;
	projColor: string | null;
	wsSlug: string;
}): MyTicket {
	return {
		id: r.id,
		number: r.number,
		title: r.title,
		priority: r.priority,
		closed: !!r.closedAt,
		dueDate: r.dueDate,
		wsSlug: r.wsSlug,
		projSlug: r.projSlug,
		projName: r.projName,
		projColor: r.projColor,
		url: `/${r.wsSlug}/${r.projSlug}/t/${r.number}`
	};
}

/** Open tickets assigned to the user, across every project they can see. */
export async function listAssignedTo(user: SessionUser): Promise<MyTicket[]> {
	const ids = await accessibleProjectIds(user);
	if (!ids.length) return [];
	const rows = await db
		.select(ticketCols)
		.from(schema.ticketAssignees)
		.innerJoin(schema.tickets, eq(schema.ticketAssignees.ticketId, schema.tickets.id))
		.innerJoin(schema.projects, eq(schema.tickets.projectId, schema.projects.id))
		.innerJoin(schema.workspaces, eq(schema.projects.workspaceId, schema.workspaces.id))
		.where(
			and(
				eq(schema.ticketAssignees.userId, user.id),
				isNull(schema.tickets.closedAt),
				inArray(schema.tickets.projectId, ids)
			)
		)
		.orderBy(desc(schema.tickets.updatedAt));
	return rows.map(toMyTicket);
}

/** Open tickets the user watches (author / assignee / manual / mention). */
export async function listWatching(user: SessionUser): Promise<MyTicket[]> {
	const ids = await accessibleProjectIds(user);
	if (!ids.length) return [];
	const rows = await db
		.select(ticketCols)
		.from(schema.watchers)
		.innerJoin(schema.tickets, eq(schema.watchers.subjectId, schema.tickets.id))
		.innerJoin(schema.projects, eq(schema.tickets.projectId, schema.projects.id))
		.innerJoin(schema.workspaces, eq(schema.projects.workspaceId, schema.workspaces.id))
		.where(
			and(
				eq(schema.watchers.userId, user.id),
				eq(schema.watchers.subjectType, 'ticket'),
				isNull(schema.tickets.closedAt),
				inArray(schema.tickets.projectId, ids)
			)
		)
		.orderBy(desc(schema.tickets.updatedAt));
	return rows.map(toMyTicket);
}

/**
 * Open tickets assigned to the user whose due date has passed or is within
 * `days` (default 7), soonest first. Includes overdue.
 */
export async function listDueSoon(user: SessionUser, days = 7, now = new Date()): Promise<MyTicket[]> {
	const ids = await accessibleProjectIds(user);
	if (!ids.length) return [];
	const cutoff = new Date(now.getTime() + days * DAY_MS);
	const rows = await db
		.select(ticketCols)
		.from(schema.ticketAssignees)
		.innerJoin(schema.tickets, eq(schema.ticketAssignees.ticketId, schema.tickets.id))
		.innerJoin(schema.projects, eq(schema.tickets.projectId, schema.projects.id))
		.innerJoin(schema.workspaces, eq(schema.projects.workspaceId, schema.workspaces.id))
		.where(
			and(
				eq(schema.ticketAssignees.userId, user.id),
				isNull(schema.tickets.closedAt),
				lte(schema.tickets.dueDate, cutoff),
				inArray(schema.tickets.projectId, ids)
			)
		)
		.orderBy(asc(schema.tickets.dueDate));
	return rows.map(toMyTicket);
}
