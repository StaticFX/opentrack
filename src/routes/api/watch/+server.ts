import { error, json } from '@sveltejs/kit';
import { requireSuggestionAccess, requireTicketAccess, requireUser } from '$lib/server/access';
import { isWatching, unwatch, watch } from '$lib/server/services/notifications';
import type { RequestHandler } from './$types';

/** Toggle the current user's subscription to a ticket or suggestion. */
export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireUser(locals.user);
	const body = await request.json();
	const subjectType = String(body.subjectType ?? '');
	const subjectId = String(body.subjectId ?? '');
	const shouldWatch = body.watch !== false;
	if (!subjectId) throw error(400, 'subjectId is required');

	// The user must be able to view the subject to watch it.
	if (subjectType === 'ticket') {
		await requireTicketAccess(locals.user, subjectId);
	} else if (subjectType === 'suggestion') {
		await requireSuggestionAccess(locals.user, subjectId);
	} else {
		throw error(400, 'Unsupported subject type');
	}

	if (shouldWatch) await watch(subjectType, subjectId, user.id, 'manual');
	else await unwatch(subjectType, subjectId, user.id);

	return json({ watching: await isWatching(subjectType, subjectId, user.id) });
};
