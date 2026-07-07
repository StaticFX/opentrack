import { and, asc, count, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { CardAssignee, CardLabel, TicketCard } from '$lib/board';
import { CLOSED_CATEGORIES, type Priority, type RelationType } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { rankAfter } from '$lib/server/util/rank';

export type Ticket = typeof schema.tickets.$inferSelect;
export type { CardAssignee, CardLabel, TicketCard } from '$lib/board';

type GhAssigneeSnapshot = Array<{ login: string; avatarUrl: string | null; githubUserId: number }>;

/**
 * Merge OpenTrack assignees (with any linked GitHub @handle) and GitHub-only
 * assignees carried in the ticket's snapshot. A snapshot login already covered
 * by a linked OpenTrack assignee is skipped so no one is listed twice.
 */
function mergeAssignees(
	openTrack: CardAssignee[],
	snapshot: GhAssigneeSnapshot | null | undefined
): CardAssignee[] {
	const covered = new Set(
		openTrack.map((a) => a.githubLogin?.toLowerCase()).filter((v): v is string => !!v)
	);
	const extra: CardAssignee[] = [];
	for (const g of snapshot ?? []) {
		if (covered.has(g.login.toLowerCase())) continue;
		extra.push({ userId: null, displayName: g.login, avatarUrl: g.avatarUrl, githubLogin: g.login });
	}
	return [...openTrack, ...extra];
}

/** All tickets on a board with their labels, assignees, and interaction counts. */
export async function listBoardTickets(boardId: string, includeArchived = false): Promise<TicketCard[]> {
	const tickets = await db
		.select()
		.from(schema.tickets)
		.where(
			and(
				eq(schema.tickets.boardId, boardId),
				includeArchived ? undefined : isNull(schema.tickets.archivedAt)
			)
		)
		.orderBy(asc(schema.tickets.position));
	if (tickets.length === 0) return [];
	const ids = tickets.map((t) => t.id);

	const [labelRows, assigneeRows, voteRows, commentRows, relationRows] = await Promise.all([
		db
			.select({
				ticketId: schema.ticketLabels.ticketId,
				id: schema.labels.id,
				name: schema.labels.name,
				color: schema.labels.color
			})
			.from(schema.ticketLabels)
			.innerJoin(schema.labels, eq(schema.ticketLabels.labelId, schema.labels.id))
			.where(inArray(schema.ticketLabels.ticketId, ids)),
		db
			.select({
				ticketId: schema.ticketAssignees.ticketId,
				userId: schema.users.id,
				displayName: schema.users.displayName,
				avatarUrl: schema.users.avatarUrl,
				githubLogin: schema.oauthAccounts.providerUsername
			})
			.from(schema.ticketAssignees)
			.innerJoin(schema.users, eq(schema.ticketAssignees.userId, schema.users.id))
			.leftJoin(
				schema.oauthAccounts,
				and(
					eq(schema.oauthAccounts.userId, schema.users.id),
					eq(schema.oauthAccounts.provider, 'github')
				)
			)
			.where(inArray(schema.ticketAssignees.ticketId, ids)),
		db
			.select({ subjectId: schema.votes.subjectId, c: count() })
			.from(schema.votes)
			.where(and(eq(schema.votes.subjectType, 'ticket'), inArray(schema.votes.subjectId, ids)))
			.groupBy(schema.votes.subjectId),
		db
			.select({ subjectId: schema.comments.subjectId, c: count() })
			.from(schema.comments)
			.where(and(eq(schema.comments.subjectType, 'ticket'), inArray(schema.comments.subjectId, ids)))
			.groupBy(schema.comments.subjectId),
		db
			.select({
				source: schema.ticketRelations.sourceTicketId,
				target: schema.ticketRelations.targetTicketId,
				type: schema.ticketRelations.type
			})
			.from(schema.ticketRelations)
			.where(
				or(
					inArray(schema.ticketRelations.sourceTicketId, ids),
					inArray(schema.ticketRelations.targetTicketId, ids)
				)
			)
	]);

	const labelsByTicket = new Map<string, CardLabel[]>();
	for (const r of labelRows) {
		const arr = labelsByTicket.get(r.ticketId) ?? [];
		arr.push({ id: r.id, name: r.name, color: r.color });
		labelsByTicket.set(r.ticketId, arr);
	}
	const assigneesByTicket = new Map<string, CardAssignee[]>();
	for (const r of assigneeRows) {
		const arr = assigneesByTicket.get(r.ticketId) ?? [];
		arr.push({ userId: r.userId, displayName: r.displayName, avatarUrl: r.avatarUrl, githubLogin: r.githubLogin });
		assigneesByTicket.set(r.ticketId, arr);
	}

	// Milestone summaries for the cards that carry one.
	const milestoneIds = [...new Set(tickets.map((t) => t.milestoneId).filter((v): v is string => !!v))];
	const milestoneById = new Map<string, { id: string; title: string; state: string }>();
	if (milestoneIds.length) {
		const ms = await db
			.select({ id: schema.milestones.id, title: schema.milestones.title, state: schema.milestones.state })
			.from(schema.milestones)
			.where(inArray(schema.milestones.id, milestoneIds));
		for (const m of ms) milestoneById.set(m.id, m);
	}
	const votesByTicket = new Map(voteRows.map((r) => [r.subjectId, Number(r.c)]));
	const commentsByTicket = new Map(commentRows.map((r) => [r.subjectId, Number(r.c)]));

	// Custom-field values for the filterable field types (select + checkbox).
	// Checkbox is normalized so an untouched box reads as 'false' — that lets a
	// "No" filter match tickets whose box was never toggled.
	const fieldDefs = await db
		.select({ id: schema.customFields.id, type: schema.customFields.type })
		.from(schema.customFields)
		.where(eq(schema.customFields.projectId, tickets[0].projectId));
	const checkboxIds = fieldDefs.filter((f) => f.type === 'checkbox').map((f) => f.id);
	const filterableIds = new Set(
		fieldDefs.filter((f) => f.type === 'select' || f.type === 'checkbox').map((f) => f.id)
	);
	const fieldValuesByTicket = new Map<string, Record<string, string>>();
	if (filterableIds.size) {
		const fieldRows = await db
			.select({
				ticketId: schema.ticketFieldValues.ticketId,
				fieldId: schema.ticketFieldValues.fieldId,
				value: schema.ticketFieldValues.value
			})
			.from(schema.ticketFieldValues)
			.where(inArray(schema.ticketFieldValues.ticketId, ids));
		for (const r of fieldRows) {
			if (!filterableIds.has(r.fieldId)) continue;
			const m = fieldValuesByTicket.get(r.ticketId) ?? {};
			m[r.fieldId] = r.value;
			fieldValuesByTicket.set(r.ticketId, m);
		}
	}
	// Default every checkbox field to 'false' on every ticket that hasn't set it.
	const fieldValuesFor = (ticketId: string): Record<string, string> => {
		const m = { ...(fieldValuesByTicket.get(ticketId) ?? {}) };
		for (const id of checkboxIds) if (!(id in m)) m[id] = 'false';
		return m;
	};

	// Relation summary per ticket: total count (either direction) + blocked flag.
	// A ticket is "blocked" when it is the target of a `blocks` relation or the
	// source of a `blocked_by` relation.
	const idSet = new Set(ids);
	const relCount = new Map<string, number>();
	const blocked = new Set<string>();
	for (const r of relationRows) {
		if (idSet.has(r.source)) {
			relCount.set(r.source, (relCount.get(r.source) ?? 0) + 1);
			if (r.type === 'blocked_by') blocked.add(r.source);
		}
		if (idSet.has(r.target)) {
			relCount.set(r.target, (relCount.get(r.target) ?? 0) + 1);
			if (r.type === 'blocks') blocked.add(r.target);
		}
	}

	return tickets.map((t) => ({
		id: t.id,
		number: t.number,
		title: t.title,
		priority: t.priority,
		columnId: t.columnId,
		position: t.position,
		dueDate: t.dueDate,
		githubIssueNumber: t.githubIssueNumber,
		githubPrNumber: t.githubPrNumber,
		githubPrState: t.githubPrState,
		githubCiStatus: t.githubCiStatus,
		milestone: t.milestoneId ? (milestoneById.get(t.milestoneId) ?? null) : null,
		hasDescription: !!(t.description && t.description.trim()),
		visibility: t.visibility,
		labels: labelsByTicket.get(t.id) ?? [],
		assignees: mergeAssignees(assigneesByTicket.get(t.id) ?? [], t.githubAssignees as GhAssigneeSnapshot | null),
		votes: votesByTicket.get(t.id) ?? 0,
		comments: commentsByTicket.get(t.id) ?? 0,
		relations: relCount.get(t.id) ?? 0,
		blocked: blocked.has(t.id),
		archived: !!t.archivedAt,
		fieldValues: fieldValuesFor(t.id)
	}));
}

export interface CreateTicketInput {
	projectId: string;
	boardId: string;
	columnId: string;
	title: string;
	description?: string;
	priority?: Priority;
}

export async function createTicket(user: SessionUser, input: CreateTicketInput): Promise<Ticket> {
	return db.transaction(async (tx) => {
		const [{ max }] = await tx
			.select({ max: sql<number>`coalesce(max(${schema.tickets.number}), 0)` })
			.from(schema.tickets)
			.where(eq(schema.tickets.projectId, input.projectId));
		const [last] = await tx
			.select({ position: schema.tickets.position })
			.from(schema.tickets)
			.where(and(eq(schema.tickets.boardId, input.boardId), eq(schema.tickets.columnId, input.columnId)))
			.orderBy(desc(schema.tickets.position))
			.limit(1);

		const [ticket] = await tx
			.insert(schema.tickets)
			.values({
				projectId: input.projectId,
				boardId: input.boardId,
				columnId: input.columnId,
				number: Number(max) + 1,
				title: input.title,
				description: input.description ?? null,
				priority: input.priority ?? 'none',
				authorId: user.id,
				position: rankAfter(last?.position ?? null)
			})
			.returning();
		return ticket;
	});
}

/**
 * Move a ticket to a column at a fractional position; toggles closedAt by
 * category. If `position` is omitted, the ticket is appended to the column end
 * (used by the modal's status selector, which doesn't know neighbor ranks).
 */
export async function moveTicket(
	ticketId: string,
	columnId: string,
	position?: string
): Promise<void> {
	const [col] = await db
		.select({ category: schema.boardColumns.category, boardId: schema.boardColumns.boardId })
		.from(schema.boardColumns)
		.where(eq(schema.boardColumns.id, columnId))
		.limit(1);
	const closing = col ? CLOSED_CATEGORIES.includes(col.category as never) : false;

	let pos = position;
	if (!pos) {
		const [last] = await db
			.select({ position: schema.tickets.position })
			.from(schema.tickets)
			.where(and(eq(schema.tickets.boardId, col?.boardId ?? ''), eq(schema.tickets.columnId, columnId)))
			.orderBy(desc(schema.tickets.position))
			.limit(1);
		pos = rankAfter(last?.position ?? null);
	}

	await db
		.update(schema.tickets)
		.set({ columnId, position: pos, closedAt: closing ? new Date() : null, updatedAt: new Date() })
		.where(eq(schema.tickets.id, ticketId));
}

export interface UpdateTicketInput {
	title?: string;
	description?: string | null;
	priority?: Priority;
	dueDate?: Date | null;
}

export async function updateTicket(ticketId: string, patch: UpdateTicketInput): Promise<void> {
	await db
		.update(schema.tickets)
		.set({
			...(patch.title !== undefined ? { title: patch.title } : {}),
			...(patch.description !== undefined ? { description: patch.description } : {}),
			...(patch.priority !== undefined ? { priority: patch.priority } : {}),
			...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
			updatedAt: new Date()
		})
		.where(eq(schema.tickets.id, ticketId));
}

export async function deleteTicket(ticketId: string): Promise<void> {
	await db.delete(schema.tickets).where(eq(schema.tickets.id, ticketId));
}

/** Archive (hide from the board) or restore a ticket. */
export async function setArchived(ticketId: string, archived: boolean): Promise<void> {
	await db
		.update(schema.tickets)
		.set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
		.where(eq(schema.tickets.id, ticketId));
}

/** Archive every not-yet-archived ticket in a column. Returns how many. */
export async function archiveColumn(columnId: string): Promise<number> {
	const now = new Date();
	const rows = await db
		.update(schema.tickets)
		.set({ archivedAt: now, updatedAt: now })
		.where(and(eq(schema.tickets.columnId, columnId), isNull(schema.tickets.archivedAt)))
		.returning({ id: schema.tickets.id });
	return rows.length;
}

// ── Assignees / labels / relations ─────────────────────────────────────────
export async function setAssignee(ticketId: string, userId: string, add: boolean): Promise<void> {
	if (add) {
		await db
			.insert(schema.ticketAssignees)
			.values({ ticketId, userId })
			.onConflictDoNothing();
	} else {
		await db
			.delete(schema.ticketAssignees)
			.where(
				and(eq(schema.ticketAssignees.ticketId, ticketId), eq(schema.ticketAssignees.userId, userId))
			);
	}
}

export async function setLabel(ticketId: string, labelId: string, add: boolean): Promise<void> {
	if (add) {
		await db.insert(schema.ticketLabels).values({ ticketId, labelId }).onConflictDoNothing();
	} else {
		await db
			.delete(schema.ticketLabels)
			.where(and(eq(schema.ticketLabels.ticketId, ticketId), eq(schema.ticketLabels.labelId, labelId)));
	}
}

export async function addRelation(
	sourceTicketId: string,
	targetTicketId: string,
	type: RelationType
): Promise<void> {
	if (sourceTicketId === targetTicketId) return;
	await db
		.insert(schema.ticketRelations)
		.values({ sourceTicketId, targetTicketId, type })
		.onConflictDoNothing();
}

export async function removeRelation(relationId: string): Promise<void> {
	await db.delete(schema.ticketRelations).where(eq(schema.ticketRelations.id, relationId));
}

// Display labels for a relation as seen from each endpoint. `out` = this ticket
// is the source (the stored direction); `in` = this ticket is the target.
const REL_LABEL_OUT: Record<RelationType, string> = {
	blocks: 'Blocks',
	blocked_by: 'Blocked by',
	relates: 'Relates to',
	duplicates: 'Duplicates',
	parent: 'Parent of',
	child: 'Child of'
};
const REL_LABEL_IN: Record<RelationType, string> = {
	blocks: 'Blocked by',
	blocked_by: 'Blocks',
	relates: 'Relates to',
	duplicates: 'Duplicated by',
	parent: 'Child of',
	child: 'Parent of'
};

/** Full ticket detail for the ticket modal. */
export async function getTicketDetail(ticketId: string) {
	const [row] = await db
		.select({
			ticket: schema.tickets,
			authorName: schema.users.displayName,
			githubRepo: schema.projects.githubRepo,
			milestoneTitle: schema.milestones.title,
			milestoneState: schema.milestones.state
		})
		.from(schema.tickets)
		.leftJoin(schema.users, eq(schema.tickets.authorId, schema.users.id))
		.leftJoin(schema.projects, eq(schema.tickets.projectId, schema.projects.id))
		.leftJoin(schema.milestones, eq(schema.tickets.milestoneId, schema.milestones.id))
		.where(eq(schema.tickets.id, ticketId))
		.limit(1);
	if (!row) return null;

	const [labels, assigneeRows, outRel, inRel, voteCount] = await Promise.all([
		db
			.select({ id: schema.labels.id, name: schema.labels.name, color: schema.labels.color })
			.from(schema.ticketLabels)
			.innerJoin(schema.labels, eq(schema.ticketLabels.labelId, schema.labels.id))
			.where(eq(schema.ticketLabels.ticketId, ticketId)),
		db
			.select({
				userId: schema.users.id,
				displayName: schema.users.displayName,
				avatarUrl: schema.users.avatarUrl,
				githubLogin: schema.oauthAccounts.providerUsername
			})
			.from(schema.ticketAssignees)
			.innerJoin(schema.users, eq(schema.ticketAssignees.userId, schema.users.id))
			.leftJoin(
				schema.oauthAccounts,
				and(
					eq(schema.oauthAccounts.userId, schema.users.id),
					eq(schema.oauthAccounts.provider, 'github')
				)
			)
			.where(eq(schema.ticketAssignees.ticketId, ticketId)),
		// Outgoing: this ticket is the source; the other ticket is the target.
		db
			.select({
				id: schema.ticketRelations.id,
				type: schema.ticketRelations.type,
				targetNumber: schema.tickets.number,
				targetTitle: schema.tickets.title
			})
			.from(schema.ticketRelations)
			.innerJoin(schema.tickets, eq(schema.ticketRelations.targetTicketId, schema.tickets.id))
			.where(eq(schema.ticketRelations.sourceTicketId, ticketId)),
		// Incoming: this ticket is the target; the other ticket is the source.
		db
			.select({
				id: schema.ticketRelations.id,
				type: schema.ticketRelations.type,
				targetNumber: schema.tickets.number,
				targetTitle: schema.tickets.title
			})
			.from(schema.ticketRelations)
			.innerJoin(schema.tickets, eq(schema.ticketRelations.sourceTicketId, schema.tickets.id))
			.where(eq(schema.ticketRelations.targetTicketId, ticketId)),
		db
			.select({ c: count() })
			.from(schema.votes)
			.where(and(eq(schema.votes.subjectType, 'ticket'), eq(schema.votes.subjectId, ticketId)))
	]);

	// Merge both directions into one list, each tagged with its display label so
	// the modal shows e.g. "Blocked by #3" on the ticket that is blocked.
	const relations = [
		...outRel.map((r) => ({
			id: r.id,
			type: r.type as RelationType,
			dir: 'out' as const,
			label: REL_LABEL_OUT[r.type as RelationType],
			targetNumber: r.targetNumber,
			targetTitle: r.targetTitle
		})),
		...inRel.map((r) => ({
			id: r.id,
			type: r.type as RelationType,
			dir: 'in' as const,
			label: REL_LABEL_IN[r.type as RelationType],
			targetNumber: r.targetNumber,
			targetTitle: r.targetTitle
		}))
	];

	const assignees = mergeAssignees(assigneeRows, row.ticket.githubAssignees as GhAssigneeSnapshot | null);

	return {
		id: row.ticket.id,
		number: row.ticket.number,
		title: row.ticket.title,
		description: row.ticket.description,
		priority: row.ticket.priority,
		columnId: row.ticket.columnId,
		dueDate: row.ticket.dueDate,
		milestoneId: row.ticket.milestoneId,
		milestone: row.ticket.milestoneId
			? { id: row.ticket.milestoneId, title: row.milestoneTitle ?? 'Milestone', state: row.milestoneState ?? 'open' }
			: null,
		githubIssueNumber: row.ticket.githubIssueNumber,
		githubPrNumber: row.ticket.githubPrNumber,
		githubPrState: row.ticket.githubPrState,
		githubPrHeadRef: row.ticket.githubPrHeadRef,
		githubPrLinkSource: row.ticket.githubPrLinkSource,
		githubCiStatus: row.ticket.githubCiStatus,
		githubRepo: row.githubRepo,
		createdAt: row.ticket.createdAt,
		closedAt: row.ticket.closedAt,
		archived: !!row.ticket.archivedAt,
		authorName: row.authorName,
		labels,
		assignees,
		relations,
		votes: Number(voteCount[0]?.c ?? 0)
	};
}

/** Count open (not-yet-closed) tickets assigned to a user, across all projects. */
export async function countOpenAssignedTo(userId: string): Promise<number> {
	const rows = await db
		.select({ n: count() })
		.from(schema.ticketAssignees)
		.innerJoin(schema.tickets, eq(schema.ticketAssignees.ticketId, schema.tickets.id))
		.where(and(eq(schema.ticketAssignees.userId, userId), isNull(schema.tickets.closedAt)));
	return rows[0].n;
}
