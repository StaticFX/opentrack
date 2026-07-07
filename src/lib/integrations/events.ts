// Client-safe catalog of the project events any Notifications-category provider
// (Discord, Slack, …) can announce. Single source of truth shared by every
// provider and the settings UI so event keys never drift.
export const NOTIFICATION_EVENTS = [
	{ key: 'ticket.created', label: 'New ticket', desc: 'A ticket is created' },
	{ key: 'ticket.closed', label: 'Ticket closed', desc: 'A ticket moves to a done/canceled column' },
	{ key: 'suggestion.created', label: 'New suggestion', desc: 'Someone submits a suggestion' },
	{ key: 'suggestion.resolved', label: 'Suggestion resolved', desc: 'A suggestion is accepted, declined, or marked duplicate' },
	{ key: 'release.published', label: 'Release published', desc: 'A release is published' }
] as const;

export type NotificationEventKey = (typeof NOTIFICATION_EVENTS)[number]['key'];

export const NOTIFICATION_EVENT_KEYS: string[] = NOTIFICATION_EVENTS.map((e) => e.key);

/** Sensible default: announce everything until the maintainer narrows it. */
export const DEFAULT_NOTIFICATION_EVENTS: string[] = [...NOTIFICATION_EVENT_KEYS];
