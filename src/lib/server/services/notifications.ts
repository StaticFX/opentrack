import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { enqueue } from '$lib/server/jobs';
import { channels, publish } from '$lib/server/realtime';

// ── Watching (subscriptions) ────────────────────────────────────────────────

export type WatchReason = 'manual' | 'author' | 'assignee' | 'commented' | 'mention';

/** Subscribe a user to a subject's activity. Idempotent. */
export async function watch(
	subjectType: string,
	subjectId: string,
	userId: string,
	reason: WatchReason = 'manual'
): Promise<void> {
	await db
		.insert(schema.watchers)
		.values({ subjectType, subjectId, userId, reason })
		.onConflictDoNothing();
}

export async function unwatch(subjectType: string, subjectId: string, userId: string): Promise<void> {
	await db
		.delete(schema.watchers)
		.where(
			and(
				eq(schema.watchers.subjectType, subjectType),
				eq(schema.watchers.subjectId, subjectId),
				eq(schema.watchers.userId, userId)
			)
		);
}

export async function isWatching(
	subjectType: string,
	subjectId: string,
	userId: string
): Promise<boolean> {
	const [row] = await db
		.select({ userId: schema.watchers.userId })
		.from(schema.watchers)
		.where(
			and(
				eq(schema.watchers.subjectType, subjectType),
				eq(schema.watchers.subjectId, subjectId),
				eq(schema.watchers.userId, userId)
			)
		)
		.limit(1);
	return !!row;
}

export async function listWatchers(subjectType: string, subjectId: string): Promise<string[]> {
	const rows = await db
		.select({ userId: schema.watchers.userId })
		.from(schema.watchers)
		.where(
			and(eq(schema.watchers.subjectType, subjectType), eq(schema.watchers.subjectId, subjectId))
		);
	return rows.map((r) => r.userId);
}

/** Maintainer-level user ids for a project (project maintainers + ws owner/admins). */
export async function listProjectMaintainerIds(projectId: string): Promise<string[]> {
	const [proj] = await db
		.select({
			workspaceId: schema.projects.workspaceId,
			ownerId: schema.workspaces.ownerId
		})
		.from(schema.projects)
		.innerJoin(schema.workspaces, eq(schema.projects.workspaceId, schema.workspaces.id))
		.where(eq(schema.projects.id, projectId))
		.limit(1);
	if (!proj) return [];

	const [pm, wm] = await Promise.all([
		db
			.select({ userId: schema.projectMembers.userId })
			.from(schema.projectMembers)
			.where(
				and(
					eq(schema.projectMembers.projectId, projectId),
					eq(schema.projectMembers.role, 'maintainer')
				)
			),
		db
			.select({ userId: schema.workspaceMembers.userId })
			.from(schema.workspaceMembers)
			.where(
				and(
					eq(schema.workspaceMembers.workspaceId, proj.workspaceId),
					inArray(schema.workspaceMembers.role, ['owner', 'admin'])
				)
			)
	]);
	return [...new Set([proj.ownerId, ...pm.map((r) => r.userId), ...wm.map((r) => r.userId)])];
}

// ── Subject resolution (deep links + titles) ────────────────────────────────

interface SubjectRef {
	projectId: string;
	title: string;
	url: string;
}

/** Resolve a subject to a viewable public URL + display title for a notification. */
export async function subjectRef(
	subjectType: string,
	subjectId: string
): Promise<SubjectRef | null> {
	if (subjectType === 'ticket') {
		const [row] = await db
			.select({
				number: schema.tickets.number,
				title: schema.tickets.title,
				projectId: schema.projects.id,
				projSlug: schema.projects.slug,
				wsSlug: schema.workspaces.slug
			})
			.from(schema.tickets)
			.innerJoin(schema.projects, eq(schema.tickets.projectId, schema.projects.id))
			.innerJoin(schema.workspaces, eq(schema.projects.workspaceId, schema.workspaces.id))
			.where(eq(schema.tickets.id, subjectId))
			.limit(1);
		if (!row) return null;
		return {
			projectId: row.projectId,
			title: `#${row.number} ${row.title}`,
			url: `/${row.wsSlug}/${row.projSlug}/t/${row.number}`
		};
	}
	if (subjectType === 'suggestion') {
		const [row] = await db
			.select({
				title: schema.suggestions.title,
				projectId: schema.projects.id,
				projSlug: schema.projects.slug,
				wsSlug: schema.workspaces.slug
			})
			.from(schema.suggestions)
			.innerJoin(schema.projects, eq(schema.suggestions.projectId, schema.projects.id))
			.innerJoin(schema.workspaces, eq(schema.projects.workspaceId, schema.workspaces.id))
			.where(eq(schema.suggestions.id, subjectId))
			.limit(1);
		if (!row) return null;
		return {
			projectId: row.projectId,
			title: row.title,
			url: `/${row.wsSlug}/${row.projSlug}/suggestions/${subjectId}`
		};
	}
	if (subjectType === 'release') {
		const [row] = await db
			.select({
				version: schema.releases.version,
				name: schema.releases.name,
				projectId: schema.projects.id,
				projSlug: schema.projects.slug,
				wsSlug: schema.workspaces.slug
			})
			.from(schema.releases)
			.innerJoin(schema.projects, eq(schema.releases.projectId, schema.projects.id))
			.innerJoin(schema.workspaces, eq(schema.projects.workspaceId, schema.workspaces.id))
			.where(eq(schema.releases.id, subjectId))
			.limit(1);
		if (!row) return null;
		return {
			projectId: row.projectId,
			title: row.name ? `${row.version} — ${row.name}` : row.version,
			// No per-release public page; link to the changelog.
			url: `/${row.wsSlug}/${row.projSlug}/releases`
		};
	}
	return null;
}

// ── Notifying ───────────────────────────────────────────────────────────────

export interface NotifyInput {
	type: string;
	subjectType: string;
	subjectId: string;
	actorId?: string | null;
	/** Headline override; defaults to the subject's own title (e.g. "#3 Fix crash"). */
	title?: string;
	/** The action line shown under the title (e.g. "Devin commented"). */
	body?: string | null;
}

/**
 * Create notifications for a set of recipients: writes inbox rows, signals each
 * user's SSE channel, and enqueues a Web Push job per recipient. Best-effort —
 * never throws into the caller.
 */
export async function notifyUsers(recipients: string[], input: NotifyInput): Promise<void> {
	const uniq = [...new Set(recipients)].filter(Boolean);
	if (!uniq.length) return;
	try {
		const ref = await subjectRef(input.subjectType, input.subjectId);
		const url = ref?.url ?? '/';
		const projectId = ref?.projectId ?? null;
		const title = input.title ?? ref?.title ?? 'OpenTrack';

		await db.insert(schema.notifications).values(
			uniq.map((userId) => ({
				userId,
				type: input.type,
				subjectType: input.subjectType,
				subjectId: input.subjectId,
				projectId,
				actorId: input.actorId ?? null,
				title,
				body: input.body ?? null,
				url
			}))
		);

		for (const userId of uniq) {
			await publish(channels.user(userId), {
				type: 'notification',
				data: { title, url }
			});
			await enqueue('notify:push', {
				userId,
				title,
				body: input.body ?? '',
				url
			});
		}
	} catch (err) {
		console.warn('[notifications] notify failed:', err);
	}
}

/**
 * Notify everyone watching a subject (excluding the actor and any explicit
 * exclusions). The common fan-out path for comments/status changes.
 */
export async function notifyWatchers(
	input: NotifyInput & { exclude?: string[] }
): Promise<void> {
	const watchers = await listWatchers(input.subjectType, input.subjectId);
	const exclude = new Set([input.actorId ?? '', ...(input.exclude ?? [])]);
	const recipients = watchers.filter((id) => !exclude.has(id));
	await notifyUsers(recipients, input);
}

// ── @mentions ────────────────────────────────────────────────────────────────

/** Extract unique lowercased @usernames from free text. */
export function parseMentions(text: string): string[] {
	const set = new Set<string>();
	for (const m of text.matchAll(/(?:^|[^\w@])@([a-zA-Z0-9_-]{2,32})/g)) {
		set.add(m[1].toLowerCase());
	}
	return [...set];
}

/** Resolve @usernames to user ids (case-insensitive, portable lower()). */
export async function resolveMentions(usernames: string[]): Promise<string[]> {
	if (!usernames.length) return [];
	const rows = await db
		.select({ id: schema.users.id })
		.from(schema.users)
		.where(inArray(sql`lower(${schema.users.username})`, usernames));
	return rows.map((r) => r.id);
}

// ── Inbox reads ──────────────────────────────────────────────────────────────

export interface NotificationView {
	id: string;
	type: string;
	subjectType: string;
	title: string;
	body: string | null;
	url: string;
	readAt: Date | null;
	createdAt: Date;
	actorName: string | null;
	actorAvatar: string | null;
}

export async function listNotifications(
	userId: string,
	opts: { limit?: number; unreadOnly?: boolean } = {}
): Promise<NotificationView[]> {
	const where = opts.unreadOnly
		? and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt))
		: eq(schema.notifications.userId, userId);
	return db
		.select({
			id: schema.notifications.id,
			type: schema.notifications.type,
			subjectType: schema.notifications.subjectType,
			title: schema.notifications.title,
			body: schema.notifications.body,
			url: schema.notifications.url,
			readAt: schema.notifications.readAt,
			createdAt: schema.notifications.createdAt,
			actorName: schema.users.displayName,
			actorAvatar: schema.users.avatarUrl
		})
		.from(schema.notifications)
		.leftJoin(schema.users, eq(schema.notifications.actorId, schema.users.id))
		.where(where)
		.orderBy(desc(schema.notifications.createdAt))
		.limit(opts.limit ?? 30) as Promise<NotificationView[]>;
}

export async function unreadCount(userId: string): Promise<number> {
	const [row] = await db
		.select({ c: sql<number>`count(*)` })
		.from(schema.notifications)
		.where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
	return Number(row?.c ?? 0);
}

/** Mark specific notifications (or all when `ids` omitted) read for a user. */
export async function markRead(userId: string, ids?: string[]): Promise<void> {
	const base = and(
		eq(schema.notifications.userId, userId),
		isNull(schema.notifications.readAt)
	);
	await db
		.update(schema.notifications)
		.set({ readAt: new Date() })
		.where(ids && ids.length ? and(base, inArray(schema.notifications.id, ids)) : base);
}

// ── Push subscription store ──────────────────────────────────────────────────

export async function savePushSubscription(
	userId: string,
	sub: { endpoint: string; p256dh: string; auth: string }
): Promise<void> {
	await db
		.insert(schema.pushSubscriptions)
		.values({ userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth })
		.onConflictDoUpdate({
			target: schema.pushSubscriptions.endpoint,
			set: { userId, p256dh: sub.p256dh, auth: sub.auth }
		});
}

export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
	await db
		.delete(schema.pushSubscriptions)
		.where(
			and(
				eq(schema.pushSubscriptions.userId, userId),
				eq(schema.pushSubscriptions.endpoint, endpoint)
			)
		);
}

export async function countPushSubscriptions(userId: string): Promise<number> {
	const [row] = await db
		.select({ c: sql<number>`count(*)` })
		.from(schema.pushSubscriptions)
		.where(eq(schema.pushSubscriptions.userId, userId));
	return Number(row?.c ?? 0);
}
