// Client-safe catalog of the events a project can announce to Discord.
// Shared by the settings UI and the server so the keys never drift.
export const DISCORD_EVENTS = [
	{ key: 'ticket.created', label: 'New ticket', desc: 'A ticket is created' },
	{ key: 'ticket.closed', label: 'Ticket closed', desc: 'A ticket moves to a done/canceled column' },
	{ key: 'suggestion.created', label: 'New suggestion', desc: 'Someone submits a suggestion' },
	{ key: 'suggestion.resolved', label: 'Suggestion resolved', desc: 'A suggestion is accepted, declined, or marked duplicate' },
	{ key: 'release.published', label: 'Release published', desc: 'A release is published' }
] as const;

export type DiscordEventKey = (typeof DISCORD_EVENTS)[number]['key'];

export const DISCORD_EVENT_KEYS: string[] = DISCORD_EVENTS.map((e) => e.key);

/** Sensible default: announce everything until the maintainer narrows it. */
export const DEFAULT_DISCORD_EVENTS: string[] = [...DISCORD_EVENT_KEYS];
