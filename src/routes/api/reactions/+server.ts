import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { REACTION_EMOJI } from '$lib/reactions';
import { requireSuggestionAccess, requireTicketAccess, requireUser } from '$lib/server/access';
import { db, schema } from '$lib/server/db';
import { rateLimit } from '$lib/server/util/ratelimit';
import { toggleReaction } from '$lib/server/services/reactions';
import type { RequestHandler } from './$types';

/** Ensure the user can view the subject a reaction targets. */
async function guard(user: App.Locals['user'], subjectType: string, subjectId: string) {
	if (subjectType === 'ticket') {
		await requireTicketAccess(user, subjectId);
	} else if (subjectType === 'suggestion') {
		await requireSuggestionAccess(user, subjectId);
	} else if (subjectType === 'comment') {
		// Reactions on a comment inherit the parent subject's access.
		const [c] = await db
			.select({ pType: schema.comments.subjectType, pId: schema.comments.subjectId })
			.from(schema.comments)
			.where(eq(schema.comments.id, subjectId))
			.limit(1);
		if (!c) throw error(404, 'Not found');
		if (c.pType === 'ticket') await requireTicketAccess(user, c.pId);
		else if (c.pType === 'suggestion') await requireSuggestionAccess(user, c.pId);
		else throw error(400, 'Unsupported subject');
	} else {
		throw error(400, 'Unsupported subject');
	}
}

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireUser(locals.user);
	const body = await request.json();
	const subjectType = String(body.subjectType ?? '');
	const subjectId = String(body.subjectId ?? '');
	const emoji = String(body.emoji ?? '');
	if (!subjectId) throw error(400, 'subjectId is required');
	if (!REACTION_EMOJI.includes(emoji as never)) throw error(400, 'Unsupported emoji');

	await guard(locals.user, subjectType, subjectId);
	if (!rateLimit(`react:${user.id}`, 60, 60_000)) throw error(429, 'Slow down');

	const reactions = await toggleReaction(subjectType, subjectId, user.id, emoji);
	return json({ reactions });
};
