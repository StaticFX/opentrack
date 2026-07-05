import { and, asc, eq } from 'drizzle-orm';
import type { SubjectType } from '$lib/constants';
import { db, schema } from '$lib/server/db';

export interface CommentView {
	id: string;
	body: string;
	edited: boolean;
	createdAt: Date;
	authorId: string | null;
	authorName: string | null;
	authorAvatar: string | null;
}

export async function listComments(
	subjectType: SubjectType,
	subjectId: string
): Promise<CommentView[]> {
	const rows = await db
		.select({
			id: schema.comments.id,
			body: schema.comments.body,
			edited: schema.comments.edited,
			createdAt: schema.comments.createdAt,
			authorId: schema.comments.authorId,
			authorName: schema.users.displayName,
			authorAvatar: schema.users.avatarUrl
		})
		.from(schema.comments)
		.leftJoin(schema.users, eq(schema.comments.authorId, schema.users.id))
		.where(
			and(eq(schema.comments.subjectType, subjectType), eq(schema.comments.subjectId, subjectId))
		)
		.orderBy(asc(schema.comments.createdAt));
	return rows;
}

export async function addComment(
	subjectType: SubjectType,
	subjectId: string,
	authorId: string,
	body: string
): Promise<string> {
	const [row] = await db
		.insert(schema.comments)
		.values({ subjectType, subjectId, authorId, body })
		.returning({ id: schema.comments.id });
	return row.id;
}

export async function updateComment(id: string, body: string): Promise<void> {
	await db
		.update(schema.comments)
		.set({ body, edited: true, updatedAt: new Date() })
		.where(eq(schema.comments.id, id));
}

export async function deleteComment(id: string): Promise<void> {
	await db.delete(schema.comments).where(eq(schema.comments.id, id));
}

/** Resolve a comment's author (for edit/delete authorization). */
export async function getCommentAuthor(id: string): Promise<string | null> {
	const [row] = await db
		.select({ authorId: schema.comments.authorId })
		.from(schema.comments)
		.where(eq(schema.comments.id, id))
		.limit(1);
	return row?.authorId ?? null;
}
