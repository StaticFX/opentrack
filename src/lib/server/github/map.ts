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

export function ticketToIssue(
	ticket: { title: string; description: string | null },
	category: ColumnCategory | string,
	labels: string[]
): IssuePayload {
	const state = categoryToState(category);
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
