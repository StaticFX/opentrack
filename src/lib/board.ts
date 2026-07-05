import type { Priority, Visibility } from '$lib/constants';

// Client-safe view types shared between the board UI and the server service.
export interface CardLabel {
	id: string;
	name: string;
	color: string;
}
export interface CardAssignee {
	userId: string;
	displayName: string;
	avatarUrl: string | null;
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
	labels: CardLabel[];
	assignees: CardAssignee[];
	votes: number;
	comments: number;
	/** Number of ticket relations touching this ticket (either direction). */
	relations: number;
	/** True when something blocks this ticket (incoming `blocks` / outgoing `blocked_by`). */
	blocked: boolean;
}
