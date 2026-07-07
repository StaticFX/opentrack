import { error, json } from '@sveltejs/kit';
import type { MilestoneState } from '$lib/constants';
import { MILESTONE_STATES } from '$lib/constants';
import { requireMilestoneAccess, requireUser } from '$lib/server/access';
import { enqueueMilestonePush } from '$lib/server/github/enqueue';
import { ACCESS } from '$lib/server/permissions';
import { deleteMilestone, updateMilestone } from '$lib/server/services/milestones';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	requireUser(locals.user);
	await requireMilestoneAccess(locals.user, params.id, ACCESS.MAINTAINER);
	const body = await request.json();
	if (body.state !== undefined && !MILESTONE_STATES.includes(body.state)) {
		throw error(400, 'Invalid milestone state');
	}
	await updateMilestone(params.id, {
		...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
		...(body.description !== undefined ? { description: body.description || null } : {}),
		...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
		...(body.state !== undefined ? { state: body.state as MilestoneState } : {})
	});
	await enqueueMilestonePush(params.id, locals.user?.id);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	requireUser(locals.user);
	await requireMilestoneAccess(locals.user, params.id, ACCESS.MAINTAINER);
	// Note: deleting locally does not delete the GitHub milestone (avoids
	// destructive cross-system side effects); it just detaches tickets here.
	await deleteMilestone(params.id);
	return json({ ok: true });
};
