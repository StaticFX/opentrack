import type { Priority, Visibility } from '$lib/constants';

// Client-safe view types shared between the board UI and the server service.
export interface CardLabel {
	id: string;
	name: string;
	color: string;
}
export interface CardAssignee {
	/** null for a GitHub assignee with no linked OpenTrack account. */
	userId: string | null;
	displayName: string;
	avatarUrl: string | null;
	/** The assignee's GitHub @handle, when a GitHub account is linked/known. */
	githubLogin?: string | null;
}
/** Milestone summary carried on a card. */
export interface CardMilestone {
	id: string;
	title: string;
	state: string;
}
export interface TicketCard {
	id: string;
	number: number;
	title: string;
	priority: Priority;
	columnId: string | null;
	position: string;
	dueDate: Date | null;
	githubIssueNumber: number | null;
	hasDescription: boolean;
	visibility: Visibility;
	/** Linked GitHub PR number + its state ('open' | 'closed' | 'merged'), if any. */
	githubPrNumber: number | null;
	githubPrState: string | null;
	/** Aggregate CI status of the linked PR ('success' | 'failure' | 'pending' | …). */
	githubCiStatus: string | null;
	milestone: CardMilestone | null;
	labels: CardLabel[];
	assignees: CardAssignee[];
	votes: number;
	comments: number;
	/** Number of ticket relations touching this ticket (either direction). */
	relations: number;
	/** True when something blocks this ticket (incoming `blocks` / outgoing `blocked_by`). */
	blocked: boolean;
	/** Archived tickets are hidden from the board unless "show archived" is on. */
	archived: boolean;
	/**
	 * Custom-field values keyed by field id. Only `select` and `checkbox` fields
	 * are carried (the filterable ones); checkbox is normalized to `'true'`/`'false'`
	 * (an untouched checkbox reads as `'false'`).
	 */
	fieldValues?: Record<string, string>;
}

/**
 * A saved/active board filter. Every dimension is multi-value: values within a
 * dimension are OR'd, dimensions are AND'd together. `q` is a free-text match on
 * `#number title`. Empty/absent arrays mean "don't filter on this dimension".
 */
export interface BoardFilters {
	q?: string;
	/** Board column (status) ids. */
	columns?: string[];
	/** Priority levels. */
	priorities?: string[];
	/** Assignee user ids; may include `FILTER_NONE` to match unassigned tickets. */
	assignees?: string[];
	/** Label ids. */
	labels?: string[];
	/** Milestone ids; may include `FILTER_NONE` to match tickets with no milestone. */
	milestones?: string[];
	/** Custom-field constraints, keyed by field id → allowed values (OR'd). */
	fields?: Record<string, string[]>;
}

/** Sentinel used in `assignees` / `milestones` to match the "none" case. */
export const FILTER_NONE = '~none';

/**
 * Coerce arbitrary stored/incoming filter data into the canonical multi-value
 * shape. Accepts the legacy single-value keys (`label`, `assignee`, `priority`,
 * `column`, `milestone`) so old saved views keep working, and drops empty
 * dimensions so `filterCount()` stays accurate.
 */
export function normalizeFilters(raw: unknown): BoardFilters {
	const f = (raw ?? {}) as Record<string, unknown>;
	const arr = (v: unknown): string[] =>
		Array.isArray(v) ? [...new Set(v.map(String).filter(Boolean))] : v ? [String(v)] : [];
	const out: BoardFilters = {};
	const q = typeof f.q === 'string' ? f.q.trim() : '';
	if (q) out.q = q;
	const columns = arr(f.columns ?? f.column);
	const priorities = arr(f.priorities ?? f.priority);
	const assignees = arr(f.assignees ?? f.assignee);
	const labels = arr(f.labels ?? f.label);
	const milestones = arr(f.milestones ?? f.milestone);
	if (columns.length) out.columns = columns;
	if (priorities.length) out.priorities = priorities;
	if (assignees.length) out.assignees = assignees;
	if (labels.length) out.labels = labels;
	if (milestones.length) out.milestones = milestones;
	if (f.fields && typeof f.fields === 'object' && !Array.isArray(f.fields)) {
		const fields: Record<string, string[]> = {};
		for (const [k, v] of Object.entries(f.fields as Record<string, unknown>)) {
			const a = arr(v);
			if (a.length) fields[k] = a;
		}
		if (Object.keys(fields).length) out.fields = fields;
	}
	return out;
}

/** Number of active constraints (each selected value counts; `q` counts once). */
export function filterCount(f: BoardFilters): number {
	return (
		(f.q?.trim() ? 1 : 0) +
		(f.columns?.length ?? 0) +
		(f.priorities?.length ?? 0) +
		(f.assignees?.length ?? 0) +
		(f.labels?.length ?? 0) +
		(f.milestones?.length ?? 0) +
		Object.values(f.fields ?? {}).reduce((n, vals) => n + vals.length, 0)
	);
}

/** Does a card satisfy the filter? OR within a dimension, AND across dimensions. */
export function ticketMatchesFilters(t: TicketCard, f: BoardFilters): boolean {
	const q = f.q?.trim().toLowerCase();
	if (q && !`#${t.number} ${t.title}`.toLowerCase().includes(q)) return false;
	if (f.columns?.length && !(t.columnId && f.columns.includes(t.columnId))) return false;
	if (f.priorities?.length && !f.priorities.includes(t.priority)) return false;
	if (f.labels?.length && !t.labels.some((l) => f.labels!.includes(l.id))) return false;
	if (f.assignees?.length) {
		const wantNone = f.assignees.includes(FILTER_NONE);
		const hasAssignee = t.assignees.some((a) => !!a.userId);
		const hit =
			t.assignees.some((a) => a.userId && f.assignees!.includes(a.userId)) ||
			(wantNone && !hasAssignee);
		if (!hit) return false;
	}
	if (f.milestones?.length) {
		const wantNone = f.milestones.includes(FILTER_NONE);
		const hit = (t.milestone && f.milestones.includes(t.milestone.id)) || (wantNone && !t.milestone);
		if (!hit) return false;
	}
	if (f.fields) {
		for (const [fieldId, vals] of Object.entries(f.fields)) {
			if (!vals.length) continue;
			if (!vals.includes(t.fieldValues?.[fieldId] ?? '')) return false;
		}
	}
	return true;
}
