import { DEFAULT_NOTIFICATION_EVENTS } from '$lib/integrations/events';
import type { FetchLike, NotificationProvider, NotifyContext, PostResult } from '../types';

const SLACK_WEBHOOK_RE = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/;

// Accent colors per event, mirroring the Discord provider's palette (hex strings
// — Slack attachments take a CSS-style color).
const COLORS: Record<string, string> = {
	'ticket.created': '#6366f1',
	'ticket.closed': '#22c55e',
	'suggestion.created': '#f59e0b',
	'suggestion.resolved': '#8b5cf6',
	'release.published': '#14b8a6'
};

const HEADLINE: Record<string, string> = {
	'ticket.created': 'New ticket',
	'ticket.closed': 'Ticket closed',
	'suggestion.created': 'New suggestion',
	'suggestion.resolved': 'Suggestion updated',
	'release.published': 'New release'
};

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/**
 * Slack notification provider. Posts a Slack "attachment" (the incoming-webhook
 * classic format — no app/bot token needed) with a colored bar, a linked title,
 * and inline fields, matching the Discord embed shape.
 */
export const slackProvider: NotificationProvider = {
	key: 'slack',
	defaultEvents: DEFAULT_NOTIFICATION_EVENTS,
	validateWebhook(url) {
		return SLACK_WEBHOOK_RE.test(url.trim()) ? null : 'That doesn’t look like a Slack incoming-webhook URL.';
	},
	buildPayload(ctx: NotifyContext) {
		const link = ctx.url
			? /^https?:\/\//.test(ctx.url)
				? ctx.url
				: ctx.origin + ctx.url
			: undefined;
		const fields = [...(ctx.fields ?? [])];
		if (ctx.actor) fields.push({ name: 'By', value: clip(ctx.actor, 64) });

		const titleText = clip(ctx.title, 250);
		return {
			attachments: [
				{
					color: COLORS[ctx.event] ?? '#6b7280',
					fallback: `${HEADLINE[ctx.event] ?? 'OpenTrack'}: ${titleText}`,
					pretext: HEADLINE[ctx.event] ?? 'OpenTrack',
					title: titleText,
					title_link: link,
					text: ctx.description ? clip(ctx.description, 500) : undefined,
					fields: fields.length
						? fields.map((f) => ({ title: f.name, value: f.value, short: true }))
						: undefined
				}
			]
		};
	},
	async post(webhookUrl: string, body: unknown, fetchImpl: FetchLike = fetch): Promise<PostResult> {
		const res = await fetchImpl(webhookUrl, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		return { ok: res.ok, status: res.status };
	}
};
