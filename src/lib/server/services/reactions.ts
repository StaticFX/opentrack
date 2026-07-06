import { and, eq, inArray } from 'drizzle-orm';
import { REACTION_EMOJI, type ReactionSummary } from '$lib/reactions';
import { db, schema } from '$lib/server/db';

function order(a: ReactionSummary, b: ReactionSummary) {
	return REACTION_EMOJI.indexOf(a.emoji as never) - REACTION_EMOJI.indexOf(b.emoji as never);
}

/** Grouped reaction summary for one subject. */
export async function summarize(
	subjectType: string,
	subjectId: string,
	userId?: string
): Promise<ReactionSummary[]> {
	const map = await reactionsFor(subjectType, [subjectId], userId);
	return map.get(subjectId) ?? [];
}

/** Batched summaries keyed by subjectId (for comment lists). */
export async function reactionsFor(
	subjectType: string,
	subjectIds: string[],
	userId?: string
): Promise<Map<string, ReactionSummary[]>> {
	const out = new Map<string, ReactionSummary[]>();
	if (!subjectIds.length) return out;
	const rows = await db
		.select({
			subjectId: schema.reactions.subjectId,
			emoji: schema.reactions.emoji,
			userId: schema.reactions.userId
		})
		.from(schema.reactions)
		.where(
			and(
				eq(schema.reactions.subjectType, subjectType),
				inArray(schema.reactions.subjectId, subjectIds)
			)
		);

	// subjectId → emoji → { count, reacted }
	const acc = new Map<string, Map<string, { count: number; reacted: boolean }>>();
	for (const r of rows) {
		let byEmoji = acc.get(r.subjectId);
		if (!byEmoji) { byEmoji = new Map(); acc.set(r.subjectId, byEmoji); }
		const cur = byEmoji.get(r.emoji) ?? { count: 0, reacted: false };
		cur.count++;
		if (userId && r.userId === userId) cur.reacted = true;
		byEmoji.set(r.emoji, cur);
	}
	for (const [subjectId, byEmoji] of acc) {
		const list = [...byEmoji].map(([emoji, v]) => ({ emoji, count: v.count, reacted: v.reacted }));
		list.sort(order);
		out.set(subjectId, list);
	}
	return out;
}

/** Toggle a reaction; returns the fresh summary for the subject. */
export async function toggleReaction(
	subjectType: string,
	subjectId: string,
	userId: string,
	emoji: string
): Promise<ReactionSummary[]> {
	const [existing] = await db
		.select({ id: schema.reactions.id })
		.from(schema.reactions)
		.where(
			and(
				eq(schema.reactions.subjectType, subjectType),
				eq(schema.reactions.subjectId, subjectId),
				eq(schema.reactions.userId, userId),
				eq(schema.reactions.emoji, emoji)
			)
		)
		.limit(1);

	if (existing) {
		await db.delete(schema.reactions).where(eq(schema.reactions.id, existing.id));
	} else {
		await db.insert(schema.reactions).values({ subjectType, subjectId, userId, emoji });
	}
	return summarize(subjectType, subjectId, userId);
}
