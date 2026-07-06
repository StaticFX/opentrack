import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { ACCESS, getProjectAccess, type AccessLevel, type ProjectAccess } from '$lib/server/permissions';

/** Require an authenticated user, else 401. */
export function requireUser(user: SessionUser | null): SessionUser {
	if (!user) throw error(401, 'Sign in required');
	return user;
}

/**
 * Guard a project operation. Verifies the project is viewable by the user
 * (member, or public) and that they meet the minimum access level. Throws 404
 * to hide private projects, 403 for insufficient level.
 */
export async function requireProjectAccess(
	user: SessionUser | null,
	projectId: string,
	min: AccessLevel = ACCESS.NONE
): Promise<ProjectAccess> {
	const access = await getProjectAccess(user, projectId);
	if (!access) throw error(404, 'Not found');

	const canView = access.level >= ACCESS.VIEWER || access.visibility === 'public';
	if (!canView) throw error(404, 'Not found');
	if (access.level < min) throw error(403, 'You do not have permission to do that.');
	return access;
}

/** Guard an operation on a board, resolving its project first. */
export async function requireBoardAccess(
	user: SessionUser | null,
	boardId: string,
	min: AccessLevel = ACCESS.NONE
): Promise<{ access: ProjectAccess; projectId: string }> {
	const [row] = await db
		.select({ projectId: schema.boards.projectId })
		.from(schema.boards)
		.where(eq(schema.boards.id, boardId))
		.limit(1);
	if (!row) throw error(404, 'Board not found');
	const access = await requireProjectAccess(user, row.projectId, min);
	return { access, projectId: row.projectId };
}

/** Guard an operation on a column, resolving board → project first. */
export async function requireColumnAccess(
	user: SessionUser | null,
	columnId: string,
	min: AccessLevel = ACCESS.NONE
): Promise<{ access: ProjectAccess; boardId: string }> {
	const [row] = await db
		.select({ boardId: schema.boardColumns.boardId, projectId: schema.boards.projectId })
		.from(schema.boardColumns)
		.innerJoin(schema.boards, eq(schema.boardColumns.boardId, schema.boards.id))
		.where(eq(schema.boardColumns.id, columnId))
		.limit(1);
	if (!row) throw error(404, 'Column not found');
	const access = await requireProjectAccess(user, row.projectId, min);
	return { access, boardId: row.boardId };
}

/** Guard an operation on a label, resolving its project first. */
export async function requireLabelAccess(
	user: SessionUser | null,
	labelId: string,
	min: AccessLevel = ACCESS.NONE
): Promise<{ access: ProjectAccess; projectId: string }> {
	const [row] = await db
		.select({ projectId: schema.labels.projectId })
		.from(schema.labels)
		.where(eq(schema.labels.id, labelId))
		.limit(1);
	if (!row) throw error(404, 'Label not found');
	const access = await requireProjectAccess(user, row.projectId, min);
	return { access, projectId: row.projectId };
}

/** Guard an operation on a milestone, resolving its project first. */
export async function requireMilestoneAccess(
	user: SessionUser | null,
	milestoneId: string,
	min: AccessLevel = ACCESS.NONE
): Promise<{ access: ProjectAccess; projectId: string }> {
	const [row] = await db
		.select({ projectId: schema.milestones.projectId })
		.from(schema.milestones)
		.where(eq(schema.milestones.id, milestoneId))
		.limit(1);
	if (!row) throw error(404, 'Milestone not found');
	const access = await requireProjectAccess(user, row.projectId, min);
	return { access, projectId: row.projectId };
}

/** Guard an operation on a suggestion, resolving its project first. */
export async function requireSuggestionAccess(
	user: SessionUser | null,
	suggestionId: string,
	min: AccessLevel = ACCESS.NONE
): Promise<{ access: ProjectAccess; projectId: string; isPublic: boolean; status: string }> {
	const [row] = await db
		.select({
			projectId: schema.suggestions.projectId,
			isPublic: schema.suggestions.isPublic,
			status: schema.suggestions.status
		})
		.from(schema.suggestions)
		.where(eq(schema.suggestions.id, suggestionId))
		.limit(1);
	if (!row) throw error(404, 'Suggestion not found');
	const access = await requireProjectAccess(user, row.projectId, min);
	// A hidden (non-public) suggestion is only reachable by project members+.
	if (!row.isPublic && access.level < ACCESS.VIEWER) throw error(404, 'Suggestion not found');
	return { access, projectId: row.projectId, isPublic: row.isPublic, status: row.status };
}

/** Guard an operation on a ticket, resolving its project first. */
export async function requireTicketAccess(
	user: SessionUser | null,
	ticketId: string,
	min: AccessLevel = ACCESS.NONE
): Promise<{ access: ProjectAccess; projectId: string; boardId: string | null; closedAt: Date | null }> {
	const [row] = await db
		.select({
			projectId: schema.tickets.projectId,
			boardId: schema.tickets.boardId,
			closedAt: schema.tickets.closedAt
		})
		.from(schema.tickets)
		.where(eq(schema.tickets.id, ticketId))
		.limit(1);
	if (!row) throw error(404, 'Ticket not found');
	const access = await requireProjectAccess(user, row.projectId, min);
	return { access, projectId: row.projectId, boardId: row.boardId, closedAt: row.closedAt };
}
