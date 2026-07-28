import { and, count, desc, eq, inArray, isNotNull, isNull, ne, or, type SQL } from 'drizzle-orm';
import type { CardAssignee, CardLabel } from '$lib/board';
import { laneForColumn } from '$lib/roadmap';
import { db, schema } from '$lib/server/db';
import { bucketWeekly, type WeeklyPoint } from './analytics';
import { getBoardColumns, listBoards } from './boards';
import { listMembers } from './projects';
import { getReleaseDetail, listReleases } from './releases';
import { listSuggestions, type SuggestionCard } from './suggestions';
import { listBoardTickets } from './tickets';
import type { VoterKey } from './votes';

/**
 * Public-safe aggregation for the public project pages, kept in one file so the
 * visibility policy is auditable in one place. Every ticket-derived helper
 * takes `isPublic` (the caller's resolved `effectiveVisibility === 'public'`)
 * and returns empty results when it is false — the public surface never shows
 * ticket data for private projects, mirroring the public board's behaviour.
 *
 * A ticket with visibility 'inherit' is public whenever the project is; only
 * an explicit 'private' hides it. Archived content never appears.
 */
const publicTicketFilter = (projectId: string): SQL =>
	and(
		eq(schema.tickets.projectId, projectId),
		ne(schema.tickets.visibility, 'private'),
		isNull(schema.tickets.archivedAt)
	)!;

const DAY = 86_400_000;

export interface PublicPulse {
	stats: {
		openTickets: number;
		closedTickets: number;
		totalTickets: number;
		openIdeas: number;
		releases: number;
		contributors: number;
	};
	/** 12 weekly opened/closed bins, oldest first — the heartbeat chart. */
	weekly: WeeklyPoint[];
	velocity: { openedLast30d: number; closedLast30d: number };
	lastActivityAt: Date | null;
}

export async function getPublicPulse(
	projectId: string,
	isPublic: boolean,
	now = new Date()
): Promise<PublicPulse> {
	const rows = isPublic
		? await db
				.select({ createdAt: schema.tickets.createdAt, closedAt: schema.tickets.closedAt })
				.from(schema.tickets)
				.where(publicTicketFilter(projectId))
		: [];

	const cutoff = now.getTime() - 30 * DAY;
	const closedRows = rows.filter((r) => r.closedAt != null);

	const [[ideas], [rel], [members], activity] = await Promise.all([
		db
			.select({ c: count() })
			.from(schema.suggestions)
			.where(
				and(
					eq(schema.suggestions.projectId, projectId),
					eq(schema.suggestions.isPublic, true),
					isNull(schema.suggestions.archivedAt),
					eq(schema.suggestions.status, 'open')
				)
			),
		db
			.select({ c: count() })
			.from(schema.releases)
			.where(and(eq(schema.releases.projectId, projectId), eq(schema.releases.status, 'published'))),
		db
			.select({ c: count() })
			.from(schema.projectMembers)
			.where(eq(schema.projectMembers.projectId, projectId)),
		listPublicActivity(projectId, isPublic, 1)
	]);

	return {
		stats: {
			openTickets: rows.length - closedRows.length,
			closedTickets: closedRows.length,
			totalTickets: rows.length,
			openIdeas: Number(ideas?.c ?? 0),
			releases: Number(rel?.c ?? 0),
			contributors: Number(members?.c ?? 0)
		},
		weekly: bucketWeekly(rows, now, 12),
		velocity: {
			openedLast30d: rows.filter((r) => new Date(r.createdAt).getTime() > cutoff).length,
			closedLast30d: closedRows.filter((r) => new Date(r.closedAt!).getTime() > cutoff).length
		},
		lastActivityAt: activity[0]?.createdAt ?? null
	};
}

export interface ProjectHeartbeat {
	open: number;
	shipped: number;
	weekly: WeeklyPoint[];
	lastActivityAt: Date | null;
}

/** Lean per-project pulse for the landing directories (2 queries per project). */
export async function getProjectHeartbeat(
	projectId: string,
	isPublic: boolean,
	now = new Date()
): Promise<ProjectHeartbeat> {
	const rows = isPublic
		? await db
				.select({ createdAt: schema.tickets.createdAt, closedAt: schema.tickets.closedAt })
				.from(schema.tickets)
				.where(publicTicketFilter(projectId))
		: [];
	const shipped = rows.filter((r) => r.closedAt != null).length;
	const [latest] = await listPublicActivity(projectId, isPublic, 1);
	return {
		open: rows.length - shipped,
		shipped,
		weekly: bucketWeekly(rows, now, 8),
		lastActivityAt: latest?.createdAt ?? null
	};
}

export interface ShippedItem {
	id: string;
	number: number;
	title: string;
	closedAt: Date;
	labels: CardLabel[];
}

export async function listRecentlyShipped(
	projectId: string,
	isPublic: boolean,
	limit = 8
): Promise<ShippedItem[]> {
	if (!isPublic) return [];
	const rows = await db
		.select({
			id: schema.tickets.id,
			number: schema.tickets.number,
			title: schema.tickets.title,
			closedAt: schema.tickets.closedAt
		})
		.from(schema.tickets)
		.where(and(publicTicketFilter(projectId), isNotNull(schema.tickets.closedAt)))
		.orderBy(desc(schema.tickets.closedAt))
		.limit(limit);
	if (rows.length === 0) return [];

	const ids = rows.map((r) => r.id);
	const labelRows = await db
		.select({
			ticketId: schema.ticketLabels.ticketId,
			id: schema.labels.id,
			name: schema.labels.name,
			color: schema.labels.color
		})
		.from(schema.ticketLabels)
		.innerJoin(schema.labels, eq(schema.ticketLabels.labelId, schema.labels.id))
		.where(inArray(schema.ticketLabels.ticketId, ids));
	const labelsByTicket = new Map<string, CardLabel[]>();
	for (const r of labelRows) {
		const arr = labelsByTicket.get(r.ticketId) ?? [];
		arr.push({ id: r.id, name: r.name, color: r.color });
		labelsByTicket.set(r.ticketId, arr);
	}

	return rows.map((r) => ({
		id: r.id,
		number: r.number,
		title: r.title,
		closedAt: r.closedAt!,
		labels: labelsByTicket.get(r.id) ?? []
	}));
}

export interface NowBuildingItem {
	id: string;
	number: number;
	title: string;
	columnName: string;
	columnColor: string;
	labels: CardLabel[];
	assignees: CardAssignee[];
	votes: number;
	comments: number;
}

export async function listNowBuilding(
	projectId: string,
	isPublic: boolean,
	limit = 8
): Promise<NowBuildingItem[]> {
	if (!isPublic) return [];
	const board = (await listBoards(projectId))[0];
	if (!board) return [];
	const columns = await getBoardColumns(board.id);
	const building = new Map(
		columns.filter((c) => laneForColumn(c) === 'in_progress').map((c) => [c.id, c])
	);
	if (building.size === 0) return [];

	const tickets = await listBoardTickets(board.id);
	return tickets
		.filter((t) => t.visibility !== 'private' && t.columnId && building.has(t.columnId))
		.slice(0, limit)
		.map((t) => ({
			id: t.id,
			number: t.number,
			title: t.title,
			columnName: building.get(t.columnId!)!.name,
			columnColor: building.get(t.columnId!)!.color,
			labels: t.labels,
			assignees: t.assignees,
			votes: t.votes,
			comments: t.comments
		}));
}

/** Trending open suggestions for the overview, with the caller's voted flag merged in. */
export async function listTopIdeas(
	projectId: string,
	opts: { includeHidden: boolean; voter?: VoterKey; limit?: number }
): Promise<Array<SuggestionCard & { voted: boolean }>> {
	const { cards, votedIds } = await listSuggestions(projectId, {
		sort: 'trending',
		status: 'open',
		publicOnly: !opts.includeHidden,
		voter: opts.voter
	});
	return cards.slice(0, opts.limit ?? 5).map((c) => ({ ...c, voted: votedIds.has(c.id) }));
}

export interface LatestRelease {
	id: string;
	version: string;
	name: string | null;
	notes: string | null;
	releasedAt: Date | null;
	links: Array<{ label: string; url: string; type: string }>;
	/** Count only — the overview never lists shipped ticket titles. */
	ticketCount: number;
}

export async function getLatestRelease(projectId: string): Promise<LatestRelease | null> {
	const [latest] = await listReleases(projectId, { publishedOnly: true });
	if (!latest) return null;
	const detail = await getReleaseDetail(latest.id);
	if (!detail) return null;
	return {
		id: detail.release.id,
		version: detail.release.version,
		name: detail.release.name,
		notes: detail.release.notes,
		releasedAt: detail.release.releasedAt,
		links: detail.links.map((l) => ({ label: l.label, url: l.url, type: l.type })),
		ticketCount: detail.tickets.length
	};
}

/** Deliberate whitelist — internal churn (moved/labeled/assigned/stale/due) stays off the public feed. */
export const PUBLIC_ACTIVITY_TYPES = [
	'ticket.created',
	'ticket.closed',
	'ticket.commented',
	'suggestion.created',
	'suggestion.status',
	'suggestion.commented',
	'release.published'
] as const;

export interface PublicActivityItem {
	id: string;
	type: string;
	createdAt: Date;
	actorName: string | null;
	actorUsername: string | null;
	actorAvatar: string | null;
	ticketNumber: number | null;
	ticketTitle: string | null;
	suggestionId: string | null;
	suggestionTitle: string | null;
	releaseVersion: string | null;
}

/**
 * Public activity feed. Not `listProjectActivity` — that helper has no
 * visibility filter (private subjects would leak) and no actor avatars.
 * Join-based subject predicates also drop rows whose subject was deleted.
 */
export async function listPublicActivity(
	projectId: string,
	isPublic: boolean,
	limit = 20
): Promise<PublicActivityItem[]> {
	const suggestionBranch = and(
		eq(schema.activity.subjectType, 'suggestion'),
		isNotNull(schema.suggestions.id),
		eq(schema.suggestions.isPublic, true),
		isNull(schema.suggestions.archivedAt)
	)!;
	const releaseBranch = and(
		eq(schema.activity.subjectType, 'release'),
		isNotNull(schema.releases.id),
		eq(schema.releases.status, 'published')
	)!;
	const branches = [suggestionBranch, releaseBranch];
	if (isPublic) {
		branches.push(
			and(
				eq(schema.activity.subjectType, 'ticket'),
				isNotNull(schema.tickets.id),
				ne(schema.tickets.visibility, 'private'),
				isNull(schema.tickets.archivedAt)
			)!
		);
	}

	const rows = await db
		.select({
			id: schema.activity.id,
			type: schema.activity.type,
			createdAt: schema.activity.createdAt,
			actorName: schema.users.displayName,
			actorUsername: schema.users.username,
			actorAvatar: schema.users.avatarUrl,
			ticketNumber: schema.tickets.number,
			ticketTitle: schema.tickets.title,
			suggestionId: schema.suggestions.id,
			suggestionTitle: schema.suggestions.title,
			releaseVersion: schema.releases.version
		})
		.from(schema.activity)
		.leftJoin(schema.users, eq(schema.activity.actorId, schema.users.id))
		.leftJoin(
			schema.tickets,
			and(eq(schema.activity.subjectType, 'ticket'), eq(schema.activity.subjectId, schema.tickets.id))
		)
		.leftJoin(
			schema.suggestions,
			and(
				eq(schema.activity.subjectType, 'suggestion'),
				eq(schema.activity.subjectId, schema.suggestions.id)
			)
		)
		.leftJoin(
			schema.releases,
			and(
				eq(schema.activity.subjectType, 'release'),
				eq(schema.activity.subjectId, schema.releases.id)
			)
		)
		.where(
			and(
				eq(schema.activity.projectId, projectId),
				inArray(schema.activity.type, [...PUBLIC_ACTIVITY_TYPES]),
				or(...branches)
			)
		)
		.orderBy(desc(schema.activity.createdAt))
		.limit(limit * 3);

	// Collapse repeats: keep only the newest row per (type, subject) so ten
	// re-triages of one suggestion read as one line, not a wall.
	const seen = new Set<string>();
	const out: PublicActivityItem[] = [];
	for (const r of rows) {
		const key = `${r.type}:${r.ticketNumber ?? r.suggestionId ?? r.releaseVersion ?? r.id}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(r);
		if (out.length >= limit) break;
	}
	return out;
}

export interface PublicMilestone {
	id: string;
	title: string;
	dueDate: Date | null;
	openCount: number;
	closedCount: number;
}

/** Open milestones with PUBLIC-only ticket counts (listMilestones counts private tickets too). */
export async function listPublicMilestones(
	projectId: string,
	isPublic: boolean,
	limit = 3
): Promise<PublicMilestone[]> {
	if (!isPublic) return [];
	const rows = await db
		.select({
			id: schema.milestones.id,
			title: schema.milestones.title,
			dueDate: schema.milestones.dueDate
		})
		.from(schema.milestones)
		.where(and(eq(schema.milestones.projectId, projectId), eq(schema.milestones.state, 'open')))
		.orderBy(schema.milestones.position, schema.milestones.createdAt)
		.limit(limit);
	if (rows.length === 0) return [];

	const ids = rows.map((r) => r.id);
	const countWhere = (closed: boolean) =>
		and(
			publicTicketFilter(projectId),
			inArray(schema.tickets.milestoneId, ids),
			closed ? isNotNull(schema.tickets.closedAt) : isNull(schema.tickets.closedAt)
		);
	const [openRows, closedRows] = await Promise.all([
		db
			.select({ milestoneId: schema.tickets.milestoneId, c: count() })
			.from(schema.tickets)
			.where(countWhere(false))
			.groupBy(schema.tickets.milestoneId),
		db
			.select({ milestoneId: schema.tickets.milestoneId, c: count() })
			.from(schema.tickets)
			.where(countWhere(true))
			.groupBy(schema.tickets.milestoneId)
	]);
	const open = new Map(openRows.map((r) => [r.milestoneId, Number(r.c)]));
	const closed = new Map(closedRows.map((r) => [r.milestoneId, Number(r.c)]));

	return rows.map((r) => ({
		...r,
		openCount: open.get(r.id) ?? 0,
		closedCount: closed.get(r.id) ?? 0
	}));
}

export interface PublicContributor {
	username: string;
	displayName: string;
	avatarUrl: string | null;
	role: string;
}

export async function listPublicContributors(projectId: string): Promise<PublicContributor[]> {
	const members = await listMembers(projectId);
	return members.map(({ username, displayName, avatarUrl, role }) => ({
		username,
		displayName,
		avatarUrl,
		role
	}));
}
