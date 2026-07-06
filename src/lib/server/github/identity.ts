import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';

/** An OpenTrack user resolved from a GitHub login. */
export interface ResolvedGithubUser {
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	/** The GitHub @handle (as stored on the linked oauth account). */
	login: string;
}

/**
 * Map GitHub logins → linked OpenTrack users (via `oauth_accounts`, provider
 * 'github'). Keyed by the lowercased login, since GitHub logins are
 * case-insensitive. Logins with no linked account are simply absent.
 */
export async function resolveGithubUsers(
	logins: string[]
): Promise<Map<string, ResolvedGithubUser>> {
	const out = new Map<string, ResolvedGithubUser>();
	const wanted = [...new Set(logins.map((l) => l.trim().toLowerCase()).filter(Boolean))];
	if (wanted.length === 0) return out;

	const rows = await db
		.select({
			userId: schema.users.id,
			displayName: schema.users.displayName,
			avatarUrl: schema.users.avatarUrl,
			login: schema.oauthAccounts.providerUsername
		})
		.from(schema.oauthAccounts)
		.innerJoin(schema.users, eq(schema.oauthAccounts.userId, schema.users.id))
		.where(
			and(
				eq(schema.oauthAccounts.provider, 'github'),
				inArray(sql`lower(${schema.oauthAccounts.providerUsername})`, wanted)
			)
		);

	for (const r of rows) {
		if (!r.login) continue;
		out.set(r.login.toLowerCase(), {
			userId: r.userId,
			displayName: r.displayName,
			avatarUrl: r.avatarUrl,
			login: r.login
		});
	}
	return out;
}

/**
 * Map OpenTrack user ids → their linked GitHub login (for outbound assignee
 * push). Users without a linked GitHub account are absent.
 */
export async function githubLoginsForUsers(userIds: string[]): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	const ids = [...new Set(userIds)].filter(Boolean);
	if (ids.length === 0) return out;

	const rows = await db
		.select({
			userId: schema.oauthAccounts.userId,
			login: schema.oauthAccounts.providerUsername
		})
		.from(schema.oauthAccounts)
		.where(
			and(eq(schema.oauthAccounts.provider, 'github'), inArray(schema.oauthAccounts.userId, ids))
		);

	for (const r of rows) if (r.login) out.set(r.userId, r.login);
	return out;
}
