import { and, count, eq } from 'drizzle-orm';
import type { SubjectType } from '$lib/constants';
import { db, schema } from '$lib/server/db';

export interface VoterKey {
	userId?: string;
	anonKey?: string;
}

export async function countVotes(subjectType: SubjectType, subjectId: string): Promise<number> {
	const [row] = await db
		.select({ c: count() })
		.from(schema.votes)
		.where(and(eq(schema.votes.subjectType, subjectType), eq(schema.votes.subjectId, subjectId)));
	return Number(row?.c ?? 0);
}

async function existingVoteId(
	subjectType: SubjectType,
	subjectId: string,
	voter: VoterKey
): Promise<string | null> {
	const match = voter.userId
		? eq(schema.votes.userId, voter.userId)
		: voter.anonKey
			? eq(schema.votes.anonKey, voter.anonKey)
			: null;
	if (!match) return null;
	const [row] = await db
		.select({ id: schema.votes.id })
		.from(schema.votes)
		.where(and(eq(schema.votes.subjectType, subjectType), eq(schema.votes.subjectId, subjectId), match))
		.limit(1);
	return row?.id ?? null;
}

/** Toggle a vote for a user or an anonymous voter. Returns the new state + count. */
export async function toggleVote(
	subjectType: SubjectType,
	subjectId: string,
	voter: VoterKey
): Promise<{ voted: boolean; count: number }> {
	if (!voter.userId && !voter.anonKey) throw new Error('voter identity required');
	const existing = await existingVoteId(subjectType, subjectId, voter);

	if (existing) {
		await db.delete(schema.votes).where(eq(schema.votes.id, existing));
	} else {
		await db.insert(schema.votes).values({
			subjectType,
			subjectId,
			userId: voter.userId ?? null,
			anonKey: voter.userId ? null : (voter.anonKey ?? null)
		});
	}
	return { voted: !existing, count: await countVotes(subjectType, subjectId) };
}

export async function hasVoted(
	subjectType: SubjectType,
	subjectId: string,
	voter: VoterKey
): Promise<boolean> {
	return (await existingVoteId(subjectType, subjectId, voter)) !== null;
}

/** Which of the given subjects the voter has already voted for (for list views). */
export async function votedSubjects(
	subjectType: SubjectType,
	voter: VoterKey
): Promise<Set<string>> {
	const match = voter.userId
		? eq(schema.votes.userId, voter.userId)
		: voter.anonKey
			? eq(schema.votes.anonKey, voter.anonKey)
			: null;
	if (!match) return new Set();
	const rows = await db
		.select({ subjectId: schema.votes.subjectId })
		.from(schema.votes)
		.where(and(eq(schema.votes.subjectType, subjectType), match));
	return new Set(rows.map((r) => r.subjectId));
}
