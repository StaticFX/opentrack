import { CLOSED_CATEGORIES, type ColumnCategory } from '$lib/constants';

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

/** Local ticket fields derived from an inbound GitHub issue payload. */
export interface IssueFields {
	title: string;
	description: string;
	githubIssueNumber: number;
	githubNodeId: string | null;
	closed: boolean;
}

export function issueToTicketFields(issue: {
	number: number;
	node_id?: string;
	title: string;
	body?: string | null;
	state: string;
}): IssueFields {
	return {
		title: issue.title,
		description: issue.body ?? '',
		githubIssueNumber: issue.number,
		githubNodeId: issue.node_id ?? null,
		closed: issue.state === 'closed'
	};
}
