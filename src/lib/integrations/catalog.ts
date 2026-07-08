// Client-safe catalog of pluggable integrations. Shared by the card UI and the
// server registry so provider keys, names, and categories never drift. NO
// server imports here — this module is bundled to the browser.

export type IntegrationCategory = 'issue_tracking' | 'notifications' | 'storage';

/** Maturity of a provider. `soon` = scaffolded but not wired end-to-end yet. */
export type IntegrationStatus = 'stable' | 'beta' | 'soon';

export interface IntegrationDescriptor {
	/** URL-safe key; also the `project_integrations.key` and registry key. */
	key: string;
	name: string;
	category: IntegrationCategory;
	/** Semantic icon name resolved to a Lucide component in the card UI. */
	icon: string;
	/** One-line description shown on the card. */
	blurb: string;
	docsUrl?: string;
	/**
	 * True when the provider needs instance-level admin credentials (e.g. a
	 * GitHub App) before a project can connect it. Notification webhooks are
	 * self-service, so they don't.
	 */
	requiresInstanceSetup: boolean;
	status: IntegrationStatus;
}

export const CATEGORY_META: Record<
	IntegrationCategory,
	{ label: string; blurb: string; icon: string }
> = {
	issue_tracking: {
		label: 'Issue Tracking',
		blurb: 'Sync tickets and issues with an external tracker.',
		icon: 'git-branch'
	},
	notifications: {
		label: 'Notifications',
		blurb: 'Announce project activity to a channel.',
		icon: 'bell'
	},
	storage: {
		label: 'Storage',
		blurb: 'Where uploaded attachments are stored.',
		icon: 'hard-drive'
	}
};

export const INTEGRATION_CATALOG: IntegrationDescriptor[] = [
	{
		key: 'github',
		name: 'GitHub',
		category: 'issue_tracking',
		icon: 'git-branch',
		blurb: 'Bidirectional issue, PR, and release sync via a GitHub App.',
		docsUrl: 'https://docs.github.com/apps',
		requiresInstanceSetup: true,
		status: 'stable'
	},
	{
		key: 'gitlab',
		name: 'GitLab',
		category: 'issue_tracking',
		icon: 'git-merge',
		blurb: 'Sync tickets with GitLab issues via a project access token.',
		docsUrl: 'https://docs.gitlab.com/ee/api/issues.html',
		requiresInstanceSetup: false,
		status: 'soon'
	},
	{
		key: 'discord',
		name: 'Discord',
		category: 'notifications',
		icon: 'message-square',
		blurb: 'Post activity to a Discord channel via an incoming webhook.',
		docsUrl: 'https://support.discord.com/hc/en-us/articles/228383668',
		requiresInstanceSetup: false,
		status: 'stable'
	},
	{
		key: 'slack',
		name: 'Slack',
		category: 'notifications',
		icon: 'hash',
		blurb: 'Post activity to a Slack channel via an incoming webhook.',
		docsUrl: 'https://api.slack.com/messaging/webhooks',
		requiresInstanceSetup: false,
		status: 'beta'
	},
	{
		key: 's3',
		name: 'S3 Storage',
		category: 'storage',
		icon: 'hard-drive',
		blurb: 'Store attachments in any S3-compatible bucket (AWS, R2, MinIO).',
		requiresInstanceSetup: true,
		status: 'stable'
	}
];

export function descriptor(key: string): IntegrationDescriptor | undefined {
	return INTEGRATION_CATALOG.find((d) => d.key === key);
}

export function byCategory(category: IntegrationCategory): IntegrationDescriptor[] {
	return INTEGRATION_CATALOG.filter((d) => d.category === category);
}

/** Project-facing categories (per-project Settings → Integrations). */
export const CATEGORY_ORDER: IntegrationCategory[] = ['issue_tracking', 'notifications'];

/** Admin-facing categories (instance-level setup) — includes storage. */
export const ADMIN_CATEGORY_ORDER: IntegrationCategory[] = [
	'issue_tracking',
	'notifications',
	'storage'
];
