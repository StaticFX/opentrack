// Server-side contracts each pluggable provider implements. The registry
// (registry.ts) holds instances; the request path and job handlers talk to
// these interfaces, never to a specific provider — that's the seam that keeps
// "add another integration" a code-only change.

export type FetchLike = typeof fetch;

export interface PostResult {
	ok: boolean;
	status: number;
}

/** Everything a notification provider needs to render one announcement. */
export interface NotifyContext {
	event: string;
	/** Subject headline, e.g. "#3 Fix crash". */
	title: string;
	/** Absolute or app-relative link to the subject. */
	url?: string;
	/** Short excerpt for the message body. */
	description?: string;
	/** Display name of whoever triggered the event. */
	actor?: string;
	/** Extra inline key/value fields (status, column, …). */
	fields?: Array<{ name: string; value: string }>;
	/** App origin, for absolutizing relative `url`s. */
	origin: string;
}

/**
 * A "Notifications" category provider (Discord, Slack, …). All current ones
 * are single-webhook-URL + event-list shaped, so the interface bakes that in:
 * secrets = `{ webhookUrl }`, config = `{ events: string[] }`.
 */
export interface NotificationProvider {
	key: string;
	/** Event keys announced by default when the integration is first enabled. */
	defaultEvents: string[];
	/** Validate the webhook URL; return an error message or null when valid. */
	validateWebhook(url: string): string | null;
	/** Build the provider-specific webhook body for one event. */
	buildPayload(ctx: NotifyContext): unknown;
	/** POST the body to the webhook. */
	post(webhookUrl: string, body: unknown, fetchImpl?: FetchLike): Promise<PostResult>;
	/**
	 * Optional: read pre-migration config from legacy per-project columns, used
	 * as a fallback when no `project_integrations` row exists yet. Lets a
	 * deployed instance keep working until the config is re-saved through the
	 * generic store. Return null when nothing legacy is configured.
	 */
	legacyState?(
		projectId: string
	): Promise<{ enabled: boolean; config: NotificationConfig; secrets: NotificationSecrets } | null>;
}

/** Config/secret shapes stored in `project_integrations` for notification providers. */
export interface NotificationConfig extends Record<string, unknown> {
	events?: string[];
}
export interface NotificationSecrets extends Record<string, unknown> {
	webhookUrl?: string;
}

/**
 * An "Issue Tracking" category provider (GitHub, GitLab, …). The request path
 * talks to this interface via the registry, never to a specific tracker.
 *
 * `actorUserId` is the OpenTrack user who triggered the change; a provider that
 * can authenticate as that user (a linked, write-scoped account) should
 * attribute the external write to them, otherwise fall back to a service/app
 * identity. See `github/client.ts` for the resolution seam.
 */
export interface IssueTrackerProvider {
	key: string;
	/** True when `projectId` is linked to this tracker. */
	isLinked(projectId: string): Promise<boolean>;
	/** Push a ticket's current state to the linked external issue. */
	pushTicket(ticketId: string, actorUserId?: string | null): Promise<void>;
	/** Push a newly created ticket comment to the linked external issue. */
	pushComment(commentId: string, actorUserId?: string | null): Promise<void>;
}
