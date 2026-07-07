// Back-compat shim: the Discord event catalog is now the shared notification
// event catalog. Kept so existing imports keep working while the UI migrates to
// the generic integration cards.
import {
	NOTIFICATION_EVENTS,
	NOTIFICATION_EVENT_KEYS,
	DEFAULT_NOTIFICATION_EVENTS,
	type NotificationEventKey
} from '$lib/integrations/events';

export const DISCORD_EVENTS = NOTIFICATION_EVENTS;
export type DiscordEventKey = NotificationEventKey;
export const DISCORD_EVENT_KEYS: string[] = NOTIFICATION_EVENT_KEYS;
export const DEFAULT_DISCORD_EVENTS: string[] = DEFAULT_NOTIFICATION_EVENTS;
