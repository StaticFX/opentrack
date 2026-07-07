// Client-safe notification presentation helpers (icon + tint per type).
import { AtSign, Bell, CheckCircle2, Clock, Lightbulb, MessageSquare, Pencil, UserPlus } from '@lucide/svelte';

export interface NotificationItem {
	id: string;
	type: string;
	subjectType: string;
	title: string;
	body: string | null;
	url: string;
	readAt: string | null;
	createdAt: string;
	actorName: string | null;
	actorAvatar: string | null;
}

/**
 * The link to follow from an in-app notification. Stored `url`s are PUBLIC deep
 * links (resolved when the notification is created, so push/anon recipients can
 * open them). Inside the app, route ticket notifications to the internal ticket
 * view instead — `/w/{ws}/p/{proj}/t/{n}` redirects members onto the board with
 * the ticket open, and falls back to the public page for non-members. Other
 * subjects (suggestions/releases) keep their public link. Idempotent.
 */
export function notificationHref(n: { subjectType?: string; url: string }): string {
	if (n.subjectType === 'ticket') {
		const m = n.url.match(/^\/([^/]+)\/([^/]+)\/t\/(\d+)$/);
		if (m) return `/w/${m[1]}/p/${m[2]}/t/${m[3]}`;
	}
	return n.url;
}

export function notificationIcon(type: string): typeof Bell {
	if (type === 'mention') return AtSign;
	if (type === 'ticket.assigned') return UserPlus;
	if (type === 'ticket.closed') return CheckCircle2;
	if (type === 'ticket.updated') return Pencil;
	if (type === 'ticket.stale') return Clock;
	if (type.startsWith('suggestion')) return Lightbulb;
	if (type.endsWith('.commented')) return MessageSquare;
	return Bell;
}

/** Tailwind text-color class for the type's icon. */
export function notificationTint(type: string): string {
	if (type === 'mention') return 'text-indigo-500';
	if (type === 'ticket.assigned') return 'text-blue-500';
	if (type === 'ticket.closed') return 'text-green-500';
	if (type === 'ticket.updated') return 'text-sky-500';
	if (type === 'ticket.stale') return 'text-orange-500';
	if (type === 'suggestion.created') return 'text-amber-500';
	if (type.startsWith('suggestion')) return 'text-amber-500';
	return 'text-neutral-400';
}
