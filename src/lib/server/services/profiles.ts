import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';

export interface ProfileSuggestion {
	id: string;
	title: string;
	status: string;
	wsSlug: string;
	projSlug: string;
	projName: string;
	votes: number;
}

export interface PublicProfile {
	username: string;
	displayName: string;
	avatarUrl: string | null;
	memberSince: Date;
	stats: { submitted: number; accepted: number };
	recent: ProfileSuggestion[];
}

/**
 * A community member's public contributions: suggestions they authored in public
 * projects. Private projects/workspaces and suspended accounts are never shown.
 */
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
	const [user] = await db
		.select({
			id: schema.users.id,
			username: schema.users.username,
			displayName: schema.users.displayName,
			avatarUrl: schema.users.avatarUrl,
			createdAt: schema.users.createdAt,
			status: schema.users.status
		})
		.from(schema.users)
		.where(sql`lower(${schema.users.username}) = ${username.toLowerCase()}`)
		.limit(1);
	if (!user || user.status !== 'active') return null;

	// Public suggestions this user authored (public workspace + non-private project).
	const rows = await db
		.select({
			id: schema.suggestions.id,
			title: schema.suggestions.title,
			status: schema.suggestions.status,
			createdAt: schema.suggestions.createdAt,
			wsSlug: schema.workspaces.slug,
			projSlug: schema.projects.slug,
			projName: schema.projects.name
		})
		.from(schema.suggestions)
		.innerJoin(schema.projects, eq(schema.suggestions.projectId, schema.projects.id))
		.innerJoin(schema.workspaces, eq(schema.projects.workspaceId, schema.workspaces.id))
		.where(
			and(
				eq(schema.suggestions.authorId, user.id),
				eq(schema.suggestions.isPublic, true),
				eq(schema.workspaces.visibility, 'public'),
				or(eq(schema.projects.visibility, 'public'), eq(schema.projects.visibility, 'inherit'))
			)
		)
		.orderBy(desc(schema.suggestions.createdAt));

	const submitted = rows.length;
	const accepted = rows.filter((r) => r.status === 'accepted' || r.status === 'converted').length;

	// Vote counts for the recent slice only.
	const recentRows = rows.slice(0, 10);
	const voteMap = new Map<string, number>();
	if (recentRows.length) {
		const counts = await db
			.select({ subjectId: schema.votes.subjectId, c: sql<number>`count(*)` })
			.from(schema.votes)
			.where(and(eq(schema.votes.subjectType, 'suggestion'), inArray(schema.votes.subjectId, recentRows.map((r) => r.id))))
			.groupBy(schema.votes.subjectId);
		for (const r of counts) voteMap.set(r.subjectId, Number(r.c));
	}

	return {
		username: user.username,
		displayName: user.displayName,
		avatarUrl: user.avatarUrl,
		memberSince: user.createdAt,
		stats: { submitted, accepted },
		recent: recentRows.map((r) => ({
			id: r.id,
			title: r.title,
			status: r.status,
			wsSlug: r.wsSlug,
			projSlug: r.projSlug,
			projName: r.projName,
			votes: voteMap.get(r.id) ?? 0
		}))
	};
}
