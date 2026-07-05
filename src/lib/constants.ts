// Shared enum unions used across the schema, services, and UI.
// These are stored as plain text columns (portable across Postgres & SQLite)
// and validated in the application layer.

export const OAUTH_PROVIDERS = ['github', 'discord', 'modrinth'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const USER_STATUSES = ['active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const INVITE_SCOPES = ['global', 'workspace', 'project'] as const;
export type InviteScope = (typeof INVITE_SCOPES)[number];

export const WORKSPACE_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const PROJECT_ROLES = ['maintainer', 'collaborator', 'viewer'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

/** Workspaces are only public|private; projects/boards/tickets add "inherit". */
export const VISIBILITIES = ['public', 'private', 'inherit'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const COLUMN_CATEGORIES = ['backlog', 'todo', 'in_progress', 'done', 'canceled'] as const;
export type ColumnCategory = (typeof COLUMN_CATEGORIES)[number];

/** Categories that map to a closed GitHub issue. */
export const CLOSED_CATEGORIES: ColumnCategory[] = ['done', 'canceled'];

export const PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SUBJECT_TYPES = ['ticket', 'suggestion', 'comment'] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export const RELATION_TYPES = [
	'blocks',
	'blocked_by',
	'relates',
	'duplicates',
	'parent',
	'child'
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

// Suggestions start as `open` (pending triage); a maintainer resolves them to
// one of accepted/declined/duplicate. `converted` is set by convert-to-ticket.
export const SUGGESTION_STATUSES = ['open', 'accepted', 'declined', 'duplicate', 'converted'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

/** The outcomes a maintainer can pick in the triage panel. */
export const SUGGESTION_DECISIONS = ['accepted', 'declined', 'duplicate'] as const;
export type SuggestionDecision = (typeof SUGGESTION_DECISIONS)[number];

export const RELEASE_STATUSES = ['draft', 'published'] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const RELEASE_LINK_TYPES = ['download', 'changelog', 'github', 'external'] as const;
export type ReleaseLinkType = (typeof RELEASE_LINK_TYPES)[number];

export const JOB_STATUSES = ['pending', 'active', 'completed', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
