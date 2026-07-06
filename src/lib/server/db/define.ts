import { sql } from 'drizzle-orm';
import type {
	InviteScope,
	JobStatus,
	MilestoneState,
	Priority,
	ProjectRole,
	RelationType,
	ReleaseLinkType,
	ReleaseStatus,
	SubjectType,
	SuggestionStatus,
	UserStatus,
	Visibility,
	WorkspaceRole
} from '$lib/constants';
import type { Kit } from './kit.pg';

/**
 * The complete OpenTrack schema, defined once against an injected column kit.
 * Called with `pgKit` and `sqliteKit` to produce dialect-specific schema
 * objects that share identical table/column names and logical shapes.
 */
export function defineSchema(kit: Kit) {
	const { table, text, int, bool, ts, json, uuid, index, uniqueIndex, primaryKey } = kit;

	const pk = () => uuid('id').primaryKey();
	const createdAt = () =>
		ts('created_at')
			.$defaultFn(() => new Date())
			.notNull();
	const updatedAt = () =>
		ts('updated_at')
			.$defaultFn(() => new Date())
			.notNull();

	// ── Identity & auth ──────────────────────────────────────────────────
	const users = table(
		'users',
		{
			id: pk(),
			email: text('email'),
			username: text('username').notNull(),
			displayName: text('display_name').notNull(),
			avatarUrl: text('avatar_url'),
			isAdmin: bool('is_admin').default(false).notNull(),
			passwordHash: text('password_hash'),
			// TOTP 2FA — secret is AES-256-GCM encrypted; only active when enabled.
			totpSecret: text('totp_secret'),
			totpEnabled: bool('totp_enabled').default(false).notNull(),
			status: text('status').$type<UserStatus>().default('active').notNull(),
			createdAt: createdAt(),
			updatedAt: updatedAt()
		},
		(t) => [
			uniqueIndex('users_email_uq').on(t.email).where(sql`${t.email} is not null`),
			uniqueIndex('users_username_uq').on(t.username)
		]
	);

	const oauthAccounts = table(
		'oauth_accounts',
		{
			id: pk(),
			userId: text('user_id')
				.notNull()
				.references(() => users.id, { onDelete: 'cascade' }),
			// Built-in enum keys OR an admin-defined custom provider key.
			provider: text('provider').notNull(),
			providerUserId: text('provider_user_id').notNull(),
			providerUsername: text('provider_username'),
			avatarUrl: text('avatar_url'),
			createdAt: createdAt()
		},
		(t) => [
			uniqueIndex('oauth_provider_uid_uq').on(t.provider, t.providerUserId),
			index('oauth_user_idx').on(t.userId)
		]
	);

	const sessions = table(
		'sessions',
		{
			// id is the SHA-256 hash of the raw session token held in the cookie.
			id: text('id').primaryKey(),
			userId: text('user_id')
				.notNull()
				.references(() => users.id, { onDelete: 'cascade' }),
			expiresAt: ts('expires_at').notNull(),
			createdAt: createdAt()
		},
		(t) => [index('sessions_user_idx').on(t.userId)]
	);

	const inviteCodes = table(
		'invite_codes',
		{
			id: pk(),
			codeHash: text('code_hash').notNull(),
			createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
			scope: text('scope').$type<InviteScope>().notNull(),
			workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
			projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
			roleGrant: text('role_grant').notNull(),
			maxUses: int('max_uses').default(1).notNull(),
			uses: int('uses').default(0).notNull(),
			expiresAt: ts('expires_at'),
			note: text('note'),
			createdAt: createdAt()
		},
		(t) => [uniqueIndex('invite_code_hash_uq').on(t.codeHash)]
	);

	const inviteRedemptions = table(
		'invite_redemptions',
		{
			id: pk(),
			inviteId: text('invite_id')
				.notNull()
				.references(() => inviteCodes.id, { onDelete: 'cascade' }),
			userId: text('user_id')
				.notNull()
				.references(() => users.id, { onDelete: 'cascade' }),
			createdAt: createdAt()
		},
		(t) => [uniqueIndex('invite_redemption_uq').on(t.inviteId, t.userId)]
	);

	// ── Hierarchy ────────────────────────────────────────────────────────
	const workspaces = table(
		'workspaces',
		{
			id: pk(),
			slug: text('slug').notNull(),
			name: text('name').notNull(),
			description: text('description'),
			icon: text('icon'),
			color: text('color'),
			avatarUrl: text('avatar_url'),
			// Public landing customization (per-workspace hero).
			publicHeadline: text('public_headline'),
			publicTagline: text('public_tagline'),
			visibility: text('visibility').$type<Visibility>().default('public').notNull(),
			ownerId: text('owner_id')
				.notNull()
				.references(() => users.id, { onDelete: 'restrict' }),
			createdAt: createdAt(),
			updatedAt: updatedAt()
		},
		(t) => [uniqueIndex('workspaces_slug_uq').on(t.slug)]
	);

	const workspaceMembers = table(
		'workspace_members',
		{
			workspaceId: text('workspace_id')
				.notNull()
				.references(() => workspaces.id, { onDelete: 'cascade' }),
			userId: text('user_id')
				.notNull()
				.references(() => users.id, { onDelete: 'cascade' }),
			role: text('role').$type<WorkspaceRole>().notNull(),
			createdAt: createdAt()
		},
		(t) => [
			primaryKey({ columns: [t.workspaceId, t.userId] }),
			index('ws_members_user_idx').on(t.userId)
		]
	);

	const projects = table(
		'projects',
		{
			id: pk(),
			workspaceId: text('workspace_id')
				.notNull()
				.references(() => workspaces.id, { onDelete: 'cascade' }),
			slug: text('slug').notNull(),
			name: text('name').notNull(),
			description: text('description'),
			icon: text('icon'),
			color: text('color'),
			visibility: text('visibility').$type<Visibility>().default('inherit').notNull(),
			githubInstallationId: text('github_installation_id'),
			githubRepo: text('github_repo'),
			// Column names whose status is mirrored to the linked issue as a
			// "Status: <name>" GitHub label (OpenTrack → GitHub progress sync).
			githubProgressLabels: json<string[]>('github_progress_labels'),
			// Column names that close the linked GitHub issue when a ticket enters
			// them. Empty/null → fall back to the column's category (done/canceled).
			githubCloseColumns: json<string[]>('github_close_columns'),
			// Which GitHub facets sync for this project (all default on when linked).
			githubSyncAssignees: bool('github_sync_assignees').default(true).notNull(),
			githubSyncLabels: bool('github_sync_labels').default(true).notNull(),
			githubSyncPriority: bool('github_sync_priority').default(true).notNull(),
			githubSyncMilestones: bool('github_sync_milestones').default(true).notNull(),
			// Discord integration: incoming-webhook URL (AES-256-GCM encrypted at rest)
			// + the set of event keys that should be announced to the channel.
			discordWebhookUrl: text('discord_webhook_url'),
			discordEvents: json<string[]>('discord_events'),
			allowPublicComments: bool('allow_public_comments').default(false).notNull(),
			githubSyncedAt: ts('github_synced_at'),
			position: text('position').notNull().default('a0'),
			createdAt: createdAt(),
			updatedAt: updatedAt()
		},
		(t) => [
			uniqueIndex('projects_ws_slug_uq').on(t.workspaceId, t.slug),
			index('projects_ws_idx').on(t.workspaceId)
		]
	);

	const projectMembers = table(
		'project_members',
		{
			projectId: text('project_id')
				.notNull()
				.references(() => projects.id, { onDelete: 'cascade' }),
			userId: text('user_id')
				.notNull()
				.references(() => users.id, { onDelete: 'cascade' }),
			role: text('role').$type<ProjectRole>().notNull(),
			createdAt: createdAt()
		},
		(t) => [
			primaryKey({ columns: [t.projectId, t.userId] }),
			index('proj_members_user_idx').on(t.userId)
		]
	);

	const boards = table(
		'boards',
		{
			id: pk(),
			projectId: text('project_id')
				.notNull()
				.references(() => projects.id, { onDelete: 'cascade' }),
			name: text('name').notNull(),
			description: text('description'),
			visibility: text('visibility').$type<Visibility>().default('inherit').notNull(),
			position: text('position').notNull().default('a0'),
			createdAt: createdAt(),
			updatedAt: updatedAt()
		},
		(t) => [index('boards_project_idx').on(t.projectId)]
	);

	const boardColumns = table(
		'board_columns',
		{
			id: pk(),
			boardId: text('board_id')
				.notNull()
				.references(() => boards.id, { onDelete: 'cascade' }),
			name: text('name').notNull(),
			color: text('color').notNull().default('#6b7280'),
			icon: text('icon'),
			category: text('category').notNull().default('todo'),
			wipLimit: int('wip_limit'),
			isDefault: bool('is_default').default(false).notNull(),
			position: text('position').notNull().default('a0'),
			createdAt: createdAt()
		},
		(t) => [index('columns_board_idx').on(t.boardId)]
	);

	// ── Tickets ──────────────────────────────────────────────────────────
	const tickets = table(
		'tickets',
		{
			id: pk(),
			projectId: text('project_id')
				.notNull()
				.references(() => projects.id, { onDelete: 'cascade' }),
			boardId: text('board_id').references(() => boards.id, { onDelete: 'set null' }),
			columnId: text('column_id').references(() => boardColumns.id, { onDelete: 'set null' }),
			milestoneId: text('milestone_id').references(() => milestones.id, { onDelete: 'set null' }),
			number: int('number').notNull(),
			title: text('title').notNull(),
			description: text('description'),
			authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
			priority: text('priority').$type<Priority>().default('none').notNull(),
			visibility: text('visibility').$type<Visibility>().default('inherit').notNull(),
			position: text('position').notNull().default('a0'),
			dueDate: ts('due_date'),
			githubIssueNumber: int('github_issue_number'),
			githubNodeId: text('github_node_id'),
			// Snapshot of the GitHub issue's assignees (login + avatar + numeric id),
			// used to render GitHub handles and assignees with no linked OpenTrack user.
			githubAssignees: json<Array<{ login: string; avatarUrl: string | null; githubUserId: number }>>(
				'github_assignees'
			),
			githubPrNumber: int('github_pr_number'),
			// Linked pull request state: 'open' | 'closed' | 'merged'.
			githubPrState: text('github_pr_state'),
			// PR head branch name (drives branch-name auto-match + display).
			githubPrHeadRef: text('github_pr_head_ref'),
			// PR head commit SHA (CI correlation fallback when check_suite carries no PRs).
			githubPrHeadSha: text('github_pr_head_sha'),
			// How the PR got linked: 'manual' (sticky, auto won't clobber) | 'branch' | 'ref'.
			githubPrLinkSource: text('github_pr_link_source'),
			// Aggregate CI status: 'success' | 'failure' | 'pending' | 'neutral' | 'error'.
			githubCiStatus: text('github_ci_status'),
			githubCiUpdatedAt: ts('github_ci_updated_at'),
			githubSyncedAt: ts('github_synced_at'),
			closedAt: ts('closed_at'),
			createdAt: createdAt(),
			updatedAt: updatedAt()
		},
		(t) => [
			uniqueIndex('tickets_project_number_uq').on(t.projectId, t.number),
			index('tickets_board_idx').on(t.boardId),
			index('tickets_column_idx').on(t.columnId),
			index('tickets_milestone_idx').on(t.milestoneId),
			index('tickets_gh_issue_idx').on(t.projectId, t.githubIssueNumber)
		]
	);

	const ticketAssignees = table(
		'ticket_assignees',
		{
			ticketId: text('ticket_id')
				.notNull()
				.references(() => tickets.id, { onDelete: 'cascade' }),
			userId: text('user_id')
				.notNull()
				.references(() => users.id, { onDelete: 'cascade' })
		},
		(t) => [
			primaryKey({ columns: [t.ticketId, t.userId] }),
			index('ticket_assignees_user_idx').on(t.userId)
		]
	);

	const labels = table(
		'labels',
		{
			id: pk(),
			projectId: text('project_id')
				.notNull()
				.references(() => projects.id, { onDelete: 'cascade' }),
			name: text('name').notNull(),
			color: text('color').notNull().default('#6b7280'),
			description: text('description')
		},
		(t) => [uniqueIndex('labels_project_name_uq').on(t.projectId, t.name)]
	);

	const ticketLabels = table(
		'ticket_labels',
		{
			ticketId: text('ticket_id')
				.notNull()
				.references(() => tickets.id, { onDelete: 'cascade' }),
			labelId: text('label_id')
				.notNull()
				.references(() => labels.id, { onDelete: 'cascade' })
		},
		(t) => [primaryKey({ columns: [t.ticketId, t.labelId] })]
	);

	const ticketRelations = table(
		'ticket_relations',
		{
			id: pk(),
			sourceTicketId: text('source_ticket_id')
				.notNull()
				.references(() => tickets.id, { onDelete: 'cascade' }),
			targetTicketId: text('target_ticket_id')
				.notNull()
				.references(() => tickets.id, { onDelete: 'cascade' }),
			type: text('type').$type<RelationType>().notNull(),
			createdAt: createdAt()
		},
		(t) => [
			uniqueIndex('ticket_relation_uq').on(t.sourceTicketId, t.targetTicketId, t.type),
			index('ticket_relation_target_idx').on(t.targetTicketId)
		]
	);

	// ── Milestones (bidirectional GitHub milestone sync) ─────────────────
	const milestones = table(
		'milestones',
		{
			id: pk(),
			projectId: text('project_id')
				.notNull()
				.references(() => projects.id, { onDelete: 'cascade' }),
			title: text('title').notNull(),
			description: text('description'),
			state: text('state').$type<MilestoneState>().default('open').notNull(),
			dueDate: ts('due_date'),
			// GitHub milestone identity: `number` is the per-repo handle we PATCH by;
			// `id` is GitHub's global id. Both null for milestones created locally
			// before their first push.
			githubMilestoneNumber: int('github_milestone_number'),
			githubMilestoneId: text('github_milestone_id'),
			githubSyncedAt: ts('github_synced_at'),
			position: text('position').notNull().default('a0'),
			createdAt: createdAt(),
			updatedAt: updatedAt()
		},
		(t) => [
			index('milestones_project_idx').on(t.projectId),
			uniqueIndex('milestones_gh_number_uq')
				.on(t.projectId, t.githubMilestoneNumber)
				.where(sql`${t.githubMilestoneNumber} is not null`)
		]
	);

	// ── Interactions (polymorphic over ticket | suggestion | comment) ─────
	const comments = table(
		'comments',
		{
			id: pk(),
			subjectType: text('subject_type').$type<SubjectType>().notNull(),
			subjectId: text('subject_id').notNull(),
			authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
			body: text('body').notNull(),
			edited: bool('edited').default(false).notNull(),
			githubCommentId: text('github_comment_id'),
			createdAt: createdAt(),
			updatedAt: updatedAt()
		},
		(t) => [index('comments_subject_idx').on(t.subjectType, t.subjectId)]
	);

	const votes = table(
		'votes',
		{
			id: pk(),
			subjectType: text('subject_type').$type<SubjectType>().notNull(),
			subjectId: text('subject_id').notNull(),
			userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
			// hash(signed cookie id + IP) for anonymous upvotes
			anonKey: text('anon_key'),
			createdAt: createdAt()
		},
		(t) => [
			index('votes_subject_idx').on(t.subjectType, t.subjectId),
			uniqueIndex('votes_user_uq')
				.on(t.subjectType, t.subjectId, t.userId)
				.where(sql`${t.userId} is not null`),
			uniqueIndex('votes_anon_uq')
				.on(t.subjectType, t.subjectId, t.anonKey)
				.where(sql`${t.anonKey} is not null`)
		]
	);

	const activity = table(
		'activity',
		{
			id: pk(),
			projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
			// Wider than SubjectType — activity also covers 'release'.
			subjectType: text('subject_type').notNull(),
			subjectId: text('subject_id').notNull(),
			actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
			type: text('type').notNull(),
			data: json<Record<string, unknown>>('data'),
			createdAt: createdAt()
		},
		(t) => [
			index('activity_subject_idx').on(t.subjectType, t.subjectId),
			index('activity_project_idx').on(t.projectId, t.createdAt)
		]
	);

	// ── Suggestions ──────────────────────────────────────────────────────
	const suggestions = table(
		'suggestions',
		{
			id: pk(),
			projectId: text('project_id')
				.notNull()
				.references(() => projects.id, { onDelete: 'cascade' }),
			authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
			title: text('title').notNull(),
			body: text('body'),
			status: text('status').$type<SuggestionStatus>().default('open').notNull(),
			declineReason: text('decline_reason'),
			convertedTicketId: text('converted_ticket_id').references(() => tickets.id, {
				onDelete: 'set null'
			}),
			// When merged as a duplicate, points at the canonical suggestion.
			duplicateOfId: text('duplicate_of_id'),
			isPublic: bool('is_public').default(true).notNull(),
			createdAt: createdAt(),
			updatedAt: updatedAt()
		},
		(t) => [index('suggestions_project_idx').on(t.projectId, t.status)]
	);

	// ── Releases ─────────────────────────────────────────────────────────
	const releases = table(
		'releases',
		{
			id: pk(),
			projectId: text('project_id')
				.notNull()
				.references(() => projects.id, { onDelete: 'cascade' }),
			version: text('version').notNull(),
			name: text('name'),
			notes: text('notes'),
			status: text('status').$type<ReleaseStatus>().default('draft').notNull(),
			releasedAt: ts('released_at'),
			githubReleaseId: text('github_release_id'),
			createdAt: createdAt(),
			updatedAt: updatedAt()
		},
		(t) => [uniqueIndex('releases_project_version_uq').on(t.projectId, t.version)]
	);

	const releaseLinks = table(
		'release_links',
		{
			id: pk(),
			releaseId: text('release_id')
				.notNull()
				.references(() => releases.id, { onDelete: 'cascade' }),
			label: text('label').notNull(),
			url: text('url').notNull(),
			type: text('type').$type<ReleaseLinkType>().default('external').notNull()
		},
		(t) => [index('release_links_release_idx').on(t.releaseId)]
	);

	const releaseTickets = table(
		'release_tickets',
		{
			releaseId: text('release_id')
				.notNull()
				.references(() => releases.id, { onDelete: 'cascade' }),
			ticketId: text('ticket_id')
				.notNull()
				.references(() => tickets.id, { onDelete: 'cascade' })
		},
		(t) => [primaryKey({ columns: [t.releaseId, t.ticketId] })]
	);

	// ── GitHub ───────────────────────────────────────────────────────────
	const githubInstallations = table(
		'github_installations',
		{
			id: pk(),
			// The workspace that connected this installation.
			workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
			installationId: text('installation_id').notNull(),
			accountLogin: text('account_login').notNull(),
			accountType: text('account_type'),
			createdAt: createdAt()
		},
		(t) => [
			uniqueIndex('gh_installation_uq').on(t.installationId),
			index('gh_installation_ws_idx').on(t.workspaceId)
		]
	);

	const githubWebhookEvents = table(
		'github_webhook_events',
		{
			id: pk(),
			deliveryId: text('delivery_id').notNull(),
			event: text('event').notNull(),
			action: text('action'),
			payload: json<Record<string, unknown>>('payload'),
			processed: bool('processed').default(false).notNull(),
			error: text('error'),
			createdAt: createdAt()
		},
		(t) => [uniqueIndex('gh_webhook_delivery_uq').on(t.deliveryId)]
	);

	// ── Portable background job queue (replaces pg-boss) ─────────────────
	const jobs = table(
		'jobs',
		{
			id: pk(),
			queue: text('queue').notNull(),
			payload: json<Record<string, unknown>>('payload'),
			status: text('status').$type<JobStatus>().default('pending').notNull(),
			attempts: int('attempts').default(0).notNull(),
			maxAttempts: int('max_attempts').default(5).notNull(),
			runAt: ts('run_at')
				.$defaultFn(() => new Date())
				.notNull(),
			lockedAt: ts('locked_at'),
			lockedBy: text('locked_by'),
			lastError: text('last_error'),
			createdAt: createdAt(),
			updatedAt: updatedAt()
		},
		(t) => [index('jobs_poll_idx').on(t.status, t.runAt)]
	);

	// ── Instance settings (visual config for OAuth / GitHub App) ─────────
	const settings = table('settings', {
		key: text('key').primaryKey(),
		value: text('value'),
		encrypted: bool('encrypted').default(false).notNull(),
		updatedAt: updatedAt()
	});

	// ── Notifications & watching ─────────────────────────────────────────
	// Who is subscribed to a subject's activity. Polymorphic subject (like
	// comments/votes) so it spans tickets, suggestions, and whole projects.
	const watchers = table(
		'watchers',
		{
			subjectType: text('subject_type').notNull(), // 'ticket' | 'suggestion' | 'project'
			subjectId: text('subject_id').notNull(),
			userId: text('user_id')
				.notNull()
				.references(() => users.id, { onDelete: 'cascade' }),
			// Why they're watching: 'manual' | 'author' | 'assignee' | 'commented' | 'mention'
			reason: text('reason').notNull().default('manual'),
			createdAt: createdAt()
		},
		(t) => [
			primaryKey({ columns: [t.subjectType, t.subjectId, t.userId] }),
			index('watchers_user_idx').on(t.userId),
			index('watchers_subject_idx').on(t.subjectType, t.subjectId)
		]
	);

	// A user-facing notification (the in-app inbox). `url` is a pre-resolved
	// deep link so rendering never needs extra joins.
	const notifications = table(
		'notifications',
		{
			id: pk(),
			userId: text('user_id')
				.notNull()
				.references(() => users.id, { onDelete: 'cascade' }),
			type: text('type').notNull(), // 'ticket.commented' | 'ticket.assigned' | 'mention' | …
			subjectType: text('subject_type').notNull(),
			subjectId: text('subject_id').notNull(),
			projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
			actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
			title: text('title').notNull(),
			body: text('body'),
			url: text('url').notNull(),
			readAt: ts('read_at'),
			createdAt: createdAt()
		},
		(t) => [
			index('notifications_user_idx').on(t.userId, t.createdAt),
			index('notifications_unread_idx').on(t.userId, t.readAt)
		]
	);

	// Browser Web Push endpoints registered per user (one row per device/browser).
	const pushSubscriptions = table(
		'push_subscriptions',
		{
			id: pk(),
			userId: text('user_id')
				.notNull()
				.references(() => users.id, { onDelete: 'cascade' }),
			endpoint: text('endpoint').notNull(),
			p256dh: text('p256dh').notNull(),
			auth: text('auth').notNull(),
			createdAt: createdAt()
		},
		(t) => [
			uniqueIndex('push_sub_endpoint_uq').on(t.endpoint),
			index('push_sub_user_idx').on(t.userId)
		]
	);

	// Emoji reactions, polymorphic over ticket | suggestion | comment (like votes).
	const reactions = table(
		'reactions',
		{
			id: pk(),
			subjectType: text('subject_type').notNull(),
			subjectId: text('subject_id').notNull(),
			userId: text('user_id')
				.notNull()
				.references(() => users.id, { onDelete: 'cascade' }),
			emoji: text('emoji').notNull(),
			createdAt: createdAt()
		},
		(t) => [
			index('reactions_subject_idx').on(t.subjectType, t.subjectId),
			uniqueIndex('reactions_uq').on(t.subjectType, t.subjectId, t.userId, t.emoji)
		]
	);

	// Per-project custom fields (text|number|select|checkbox|date) + their values.
	const customFields = table(
		'custom_fields',
		{
			id: pk(),
			projectId: text('project_id')
				.notNull()
				.references(() => projects.id, { onDelete: 'cascade' }),
			name: text('name').notNull(),
			type: text('type').notNull(), // 'text' | 'number' | 'select' | 'checkbox' | 'date'
			options: json<string[]>('options'), // choices for 'select'
			position: text('position').notNull().default('a0'),
			createdAt: createdAt()
		},
		(t) => [index('custom_fields_project_idx').on(t.projectId)]
	);

	const ticketFieldValues = table(
		'ticket_field_values',
		{
			id: pk(),
			ticketId: text('ticket_id')
				.notNull()
				.references(() => tickets.id, { onDelete: 'cascade' }),
			fieldId: text('field_id')
				.notNull()
				.references(() => customFields.id, { onDelete: 'cascade' }),
			// All values stored as text; parsed per field type in the app.
			value: text('value').notNull()
		},
		(t) => [uniqueIndex('ticket_field_uq').on(t.ticketId, t.fieldId)]
	);

	// Lightweight sub-tasks / acceptance criteria on a ticket.
	const checklistItems = table(
		'checklist_items',
		{
			id: pk(),
			ticketId: text('ticket_id')
				.notNull()
				.references(() => tickets.id, { onDelete: 'cascade' }),
			text: text('text').notNull(),
			done: bool('done').default(false).notNull(),
			position: text('position').notNull().default('a0'),
			createdAt: createdAt()
		},
		(t) => [index('checklist_ticket_idx').on(t.ticketId)]
	);

	// Saved board filter presets ("views"). Personal by default; `shared` exposes
	// a view to everyone who can see the board.
	const boardViews = table(
		'board_views',
		{
			id: pk(),
			boardId: text('board_id')
				.notNull()
				.references(() => boards.id, { onDelete: 'cascade' }),
			userId: text('user_id')
				.notNull()
				.references(() => users.id, { onDelete: 'cascade' }),
			name: text('name').notNull(),
			// { q?, label?, assignee?, priority? }
			filters: json<Record<string, unknown>>('filters'),
			shared: bool('shared').default(false).notNull(),
			createdAt: createdAt()
		},
		(t) => [
			index('board_views_board_idx').on(t.boardId),
			index('board_views_user_idx').on(t.userId)
		]
	);

	// Workspace-scoped API keys for the public read API. Only the SHA-256 hash is
	// stored; the raw key is shown once on creation.
	const apiKeys = table(
		'api_keys',
		{
			id: pk(),
			workspaceId: text('workspace_id')
				.notNull()
				.references(() => workspaces.id, { onDelete: 'cascade' }),
			name: text('name').notNull(),
			keyHash: text('key_hash').notNull(),
			prefix: text('prefix').notNull(), // first chars, for display ("otk_ab12…")
			createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
			lastUsedAt: ts('last_used_at'),
			createdAt: createdAt()
		},
		(t) => [
			uniqueIndex('api_keys_hash_uq').on(t.keyHash),
			index('api_keys_ws_idx').on(t.workspaceId)
		]
	);

	// Admin-defined custom OAuth2/OIDC login providers (beyond the built-ins).
	const oauthProviders = table(
		'oauth_providers',
		{
			id: pk(),
			key: text('key').notNull(), // url slug, e.g. "google"
			label: text('label').notNull(),
			icon: text('icon'), // emoji or image URL
			authorizationEndpoint: text('authorization_endpoint').notNull(),
			tokenEndpoint: text('token_endpoint').notNull(),
			userinfoEndpoint: text('userinfo_endpoint').notNull(),
			scopes: text('scopes').notNull().default('openid email profile'),
			clientId: text('client_id').notNull(),
			clientSecret: text('client_secret').notNull(), // AES-256-GCM encrypted
			enabled: bool('enabled').default(true).notNull(),
			createdAt: createdAt(),
			updatedAt: updatedAt()
		},
		(t) => [uniqueIndex('oauth_providers_key_uq').on(t.key)]
	);

	return {
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
	};
}

export type Schema = ReturnType<typeof defineSchema>;
