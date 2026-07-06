// Postgres schema entrypoint — consumed by drizzle-kit (DATABASE_DRIVER=postgres)
// and used as the canonical type source for the app.
import { defineSchema } from './define';
import { pgKit } from './kit.pg';

export const schema = defineSchema(pgKit);

// Named exports so drizzle-kit discovers every table.
export const {
	watchers,
	notifications,
	pushSubscriptions,
	reactions,
	customFields,
	ticketFieldValues,
	checklistItems,
	apiKeys,
	boardViews,
	oauthProviders,
	settings,
	users,
	oauthAccounts,
	sessions,
	inviteCodes,
	inviteRedemptions,
	workspaces,
	workspaceMembers,
	projects,
	projectMembers,
	boards,
	boardColumns,
	tickets,
	ticketAssignees,
	labels,
	ticketLabels,
	ticketRelations,
	comments,
	votes,
	activity,
	suggestions,
	releases,
	releaseLinks,
	releaseTickets,
	githubInstallations,
	githubWebhookEvents,
	jobs
} = schema;
