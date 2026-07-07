import { error, json } from '@sveltejs/kit';
import type { MilestoneState } from '$lib/constants';
import { MILESTONE_STATES } from '$lib/constants';
import { requireProjectAccess, requireUser } from '$lib/server/access';
import { enqueueMilestonePush } from '$lib/server/github/enqueue';
import { ACCESS } from '$lib/server/permissions';
import { createMilestone, listMilestones } from '$lib/server/services/milestones';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	await requireProjectAccess(locals.user, params.projectId);
	return json({ milestones: await listMilestones(params.projectId) });
};

export const POST: RequestHandler = async ({ params, locals, request }) => {
	requireUser(locals.user);
	await requireProjectAccess(locals.user, params.projectId, ACCESS.MAINTAINER);
	const body = await request.json();
	const title = String(body.title ?? '').trim();
	if (!title) throw error(400, 'Milestone title is required');
	const state: MilestoneState = MILESTONE_STATES.includes(body.state) ? body.state : 'open';
	const milestone = await createMilestone(params.projectId, {
		title,
		description: body.description ? String(body.description) : null,
		dueDate: body.dueDate ? new Date(body.dueDate) : null,
		state
	});
	await enqueueMilestonePush(milestone.id, locals.user?.id);
	return json(milestone);
};
