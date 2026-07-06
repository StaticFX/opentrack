import { error, json } from '@sveltejs/kit';
import { requireProjectAccess } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { deleteRule, ruleProjectId, updateRule, type RuleInput } from '$lib/server/services/workflow';
import type { RequestHandler } from './$types';

async function authz(id: string, user: App.Locals['user']) {
	const projectId = await ruleProjectId(id);
	if (!projectId) throw error(404, 'Rule not found');
	await requireProjectAccess(user, projectId, ACCESS.MAINTAINER);
}

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	await authz(params.id, locals.user);
	const b = (await request.json()) as Partial<RuleInput> & { enabled?: boolean };
	await updateRule(params.id, b);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	await authz(params.id, locals.user);
	await deleteRule(params.id);
	return json({ ok: true });
};
