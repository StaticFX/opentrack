// SQLite schema entrypoint — consumed by drizzle-kit (DATABASE_DRIVER=sqlite).
// Same logical shape as schema.pg.ts, built from the SQLite column kit.
import { defineSchema } from './define';
import { sqliteKit } from './kit.sqlite';

export const schema = defineSchema(sqliteKit);

// Named exports so drizzle-kit discovers every table.
export const {
	attachments,
	workflowRules,
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
	projectIntegrations,
	boards,
	boardColumns,
	tickets,
	ticketAssignees,
	milestones,
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
