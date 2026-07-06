import { CLOSED_CATEGORIES, type ColumnCategory, type MilestoneState, type Priority } from '$lib/constants';
import { isPriorityLabel, priorityFromLabels } from '$lib/github-labels';

/** Column category → GitHub issue state. */
export function categoryToState(category: ColumnCategory | string): 'open' | 'closed' {
	return CLOSED_CATEGORIES.includes(category as ColumnCategory) ? 'closed' : 'open';
}

/** Parse an "owner/name" repo string. */
export function parseRepo(fullName: string | null | undefined): { owner: string; repo: string } | null {
	if (!fullName) return null;
	const [owner, repo] = fullName.split('/');
	if (!owner || !repo) return null;
	return { owner, repo };
}

/** Fields to send to GitHub when creating/updating an issue from a ticket. */
export interface IssuePayload {
	title: string;
	body: string;
	state: 'open' | 'closed';
	/** GitHub close reason — 'completed' for done, 'not_planned' for canceled. */
	stateReason: 'completed' | 'not_planned' | 'reopened' | null;
	labels: string[];
}

/**
 * Whether a ticket in `columnName` (of `category`) should close its linked
 * GitHub issue. When the project configures explicit close columns, only those
 * close it; otherwise fall back to the column's category (done / canceled).
 */
export function shouldCloseIssue(
	closeColumns: string[] | null | undefined,
	columnName: string | null | undefined,
	category: ColumnCategory | string
): boolean {
	if (closeColumns && closeColumns.length > 0) {
		return !!columnName && closeColumns.includes(columnName);
	}
	return categoryToState(category) === 'closed';
}

export function ticketToIssue(
	ticket: { title: string; description: string | null },
	category: ColumnCategory | string,
	labels: string[],
	/** Override the open/closed decision (else derived from category). */
	closedOverride?: boolean
): IssuePayload {
	const state = (closedOverride ?? categoryToState(category) === 'closed') ? 'closed' : 'open';
	const stateReason =
		state === 'closed' ? (category === 'canceled' ? 'not_planned' : 'completed') : 'reopened';
	return {
		title: ticket.title,
		body: ticket.description ?? '',
		state,
		stateReason,
		labels
	};
}

/** Aggregate CI status shown on a linked PR. */
export type CiStatus = 'success' | 'failure' | 'pending' | 'neutral' | 'error';

/**
 * True if a PR branch name references the given issue number as a distinct
 * numeric token. Splits on non-digits so `123-fix`, `feature/OT-123`, and
 * `fix/123_bug` all match issue 123, but `1234-x` (→ token 1234) does not.
 */
export function branchMatchesIssue(
	branch: string | null | undefined,
	issueNumber: number | null | undefined
): boolean {
	if (!branch || !issueNumber) return false;
	return branch
		.split(/\D+/)
		.filter((t) => t.length > 0)
		.some((t) => Number(t) === issueNumber);
}

/**
 * Reduce a set of GitHub check-runs to a single aggregate CI status.
 * Precedence: any still running → 'pending'; any hard failure → 'failure';
 * any needs-attention → 'error'; otherwise 'success'. Empty list → null.
 */
export function aggregateCheckStatus(
	runs: Array<{ status?: string | null; conclusion?: string | null }>
): CiStatus | null {
	if (!runs || runs.length === 0) return null;
	if (runs.some((r) => r.status !== 'completed')) return 'pending';
	const concl = runs.map((r) => r.conclusion ?? '');
	if (concl.some((c) => c === 'failure' || c === 'timed_out')) return 'failure';
	if (concl.some((c) => c === 'action_required' || c === 'stale')) return 'error';
	// success / neutral / skipped / cancelled treated as passing-or-ignorable.
	return 'success';
}

/**
 * Map a GitHub check_suite (status + conclusion) to our aggregate CI status.
 * Incomplete suites are 'pending'; a completed suite maps by conclusion.
 */
export function checkSuiteStatus(
	status: string | null | undefined,
	conclusion: string | null | undefined
): CiStatus | null {
	if (status && status !== 'completed') return 'pending';
	if (!conclusion) return status === 'completed' ? 'neutral' : 'pending';
	switch (conclusion) {
		case 'success':
			return 'success';
		case 'failure':
		case 'timed_out':
		case 'startup_failure':
			return 'failure';
		case 'action_required':
		case 'stale':
			return 'error';
		default:
			// neutral / skipped / cancelled
			return 'neutral';
	}
}

/** A GitHub issue assignee, normalized for storage/display. */
export interface GhAssignee {
	login: string;
	avatarUrl: string | null;
	githubUserId: number;
}

/** A GitHub milestone reference carried on an issue payload. */
export interface GhMilestoneRef {
	number: number;
	githubMilestoneId: string | null;
	title: string;
	description: string | null;
	state: MilestoneState;
	dueOn: Date | null;
}

/** Local ticket fields derived from an inbound GitHub issue payload. */
export interface IssueFields {
	title: string;
	description: string;
	githubIssueNumber: number;
	githubNodeId: string | null;
	closed: boolean;
	/** Non-priority label names (priority labels are folded into `priority`). */
	labels: string[];
	/** Priority parsed from any `priority: <level>` label; 'none' if absent. */
	priority: Priority;
	assignees: GhAssignee[];
	milestone: GhMilestoneRef | null;
}

type RawLabel = string | { name?: string | null };

interface RawIssue {
	number: number;
	node_id?: string;
	title: string;
	body?: string | null;
	state: string;
	labels?: RawLabel[];
	assignees?: Array<{ login?: string | null; id?: number; avatar_url?: string | null }> | null;
	milestone?: {
		number?: number;
		id?: number;
		title?: string;
		description?: string | null;
		state?: string;
		due_on?: string | null;
	} | null;
}

function labelName(l: RawLabel): string | null {
	return (typeof l === 'string' ? l : l?.name) ?? null;
}

/** Progress-mirror labels ("Status: <col>") are managed, not real ticket labels. */
function isProgressLabel(name: string): boolean {
	return name.startsWith('Status: ');
}

/** Normalize an inbound milestone payload, or null when absent/malformed. */
export function issueMilestone(m: RawIssue['milestone']): GhMilestoneRef | null {
	if (!m || typeof m.number !== 'number' || !m.title) return null;
	return {
		number: m.number,
		githubMilestoneId: m.id != null ? String(m.id) : null,
		title: m.title,
		description: m.description ?? null,
		state: m.state === 'closed' ? 'closed' : 'open',
		dueOn: m.due_on ? new Date(m.due_on) : null
	};
}

export function issueToTicketFields(issue: RawIssue): IssueFields {
	const allNames = (issue.labels ?? []).map(labelName).filter((n): n is string => !!n);
	return {
		title: issue.title,
		description: issue.body ?? '',
		githubIssueNumber: issue.number,
		githubNodeId: issue.node_id ?? null,
		closed: issue.state === 'closed',
		labels: allNames.filter((n) => !isPriorityLabel(n) && !isProgressLabel(n)),
		priority: priorityFromLabels(allNames),
		assignees: (issue.assignees ?? [])
			.filter((a): a is { login: string; id: number; avatar_url?: string | null } => !!a?.login && typeof a.id === 'number')
			.map((a) => ({ login: a.login, avatarUrl: a.avatar_url ?? null, githubUserId: a.id })),
		milestone: issueMilestone(issue.milestone)
	};
}
