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
	milestone: CardMilestone | null;
	labels: CardLabel[];
	assignees: CardAssignee[];
	votes: number;
	comments: number;
	/** Number of ticket relations touching this ticket (either direction). */
	relations: number;
	/** True when something blocks this ticket (incoming `blocks` / outgoing `blocked_by`). */
	blocked: boolean;
}
