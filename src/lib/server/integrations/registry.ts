import { byCategory } from '$lib/integrations/catalog';
import { discordProvider } from './providers/discord';
import { githubProvider } from './providers/github';
import { gitlabProvider } from './providers/gitlab';
import { slackProvider } from './providers/slack';
import { getIntegration } from './store';
import type {
	IssueTrackerProvider,
	NotificationConfig,
	NotificationProvider,
	NotificationSecrets
} from './types';

export interface ResolvedNotificationState {
	enabled: boolean;
	config: NotificationConfig;
	secrets: NotificationSecrets;
}

// ── Notifications category ─────────────────────────────────────────────────
const notificationProviders = new Map<string, NotificationProvider>([
	[discordProvider.key, discordProvider],
	[slackProvider.key, slackProvider]
]);

export function getNotificationProvider(key: string): NotificationProvider | undefined {
	return notificationProviders.get(key);
}

/** Keys of every registered notification provider (Discord, Slack, …). */
export function notificationProviderKeys(): string[] {
	return [...notificationProviders.keys()];
}

/**
 * Notification provider keys that are also present in the client catalog, in
 * catalog order — the set the fan-out iterates and the UI renders as cards.
 */
export function notificationCatalogKeys(): string[] {
	return byCategory('notifications')
		.map((d) => d.key)
		.filter((k) => notificationProviders.has(k));
}

/**
 * Resolve a project's notification state for a provider: the generic
 * `project_integrations` row if present, else the provider's legacy fallback.
 * Returns null when the provider isn't configured for the project at all.
 */
export async function resolveNotificationState(
	provider: NotificationProvider,
	projectId: string
): Promise<ResolvedNotificationState | null> {
	const row = await getIntegration<NotificationConfig, NotificationSecrets>(projectId, provider.key);
	if (row) return row;
	return provider.legacyState ? await provider.legacyState(projectId) : null;
}

// ── Issue Tracking category ────────────────────────────────────────────────
const issueTrackers = new Map<string, IssueTrackerProvider>([
	[githubProvider.key, githubProvider],
	[gitlabProvider.key, gitlabProvider]
]);

export function getIssueTracker(key: string): IssueTrackerProvider | undefined {
	return issueTrackers.get(key);
}

/** Issue-tracker provider keys in catalog order. */
export function issueTrackerCatalogKeys(): string[] {
	return byCategory('issue_tracking')
		.map((d) => d.key)
		.filter((k) => issueTrackers.has(k));
}

/** The issue tracker a project is linked to, if any (first match in catalog order). */
export async function linkedIssueTracker(projectId: string): Promise<IssueTrackerProvider | null> {
	for (const key of issueTrackerCatalogKeys()) {
		const provider = issueTrackers.get(key)!;
		if (await provider.isLinked(projectId)) return provider;
	}
	return null;
}
