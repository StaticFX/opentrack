import { DEFAULT_NOTIFICATION_EVENTS } from '$lib/integrations/events';
import { getProjectDiscord } from '$lib/server/discord/config';
import { buildDiscordPayload, postDiscord } from '$lib/server/discord/send';
import type { FetchLike, NotificationProvider, NotifyContext, PostResult } from '../types';

const DISCORD_WEBHOOK_RE = /^https:\/\/(?:\w+\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/i;

/**
 * Discord notification provider. Delegates payload/POST to the existing
 * `server/discord/send` helpers so the rich-embed behavior is unchanged; this
 * just adapts it to the generic NotificationProvider contract.
 */
export const discordProvider: NotificationProvider = {
	key: 'discord',
	defaultEvents: DEFAULT_NOTIFICATION_EVENTS,
	validateWebhook(url) {
		return DISCORD_WEBHOOK_RE.test(url.trim()) ? null : 'That doesn’t look like a Discord webhook URL.';
	},
	buildPayload(ctx: NotifyContext) {
		return buildDiscordPayload(
			ctx.event,
			{
				title: ctx.title,
				url: ctx.url,
				description: ctx.description,
				actor: ctx.actor,
				fields: ctx.fields
			},
			ctx.origin
		);
	},
	post(webhookUrl: string, body: unknown, fetchImpl?: FetchLike): Promise<PostResult> {
		return postDiscord(webhookUrl, body, fetchImpl);
	},
	// Fall back to the legacy `projects.discord_*` columns for projects that
	// configured Discord before the generic store existed. Re-saving through the
	// integration card writes a `project_integrations` row that then wins.
	async legacyState(projectId: string) {
		const cfg = await getProjectDiscord(projectId);
		if (!cfg.webhookUrl) return null;
		return { enabled: true, config: { events: cfg.events }, secrets: { webhookUrl: cfg.webhookUrl } };
	}
};
