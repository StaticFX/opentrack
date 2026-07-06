import { error, json } from '@sveltejs/kit';
import { requireProjectAccess } from '$lib/server/access';
import { ACCESS } from '$lib/server/permissions';
import { createRule, listRules, type RuleInput } from '$lib/server/services/workflow';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	await requireProjectAccess(locals.user, params.projectId, ACCESS.MAINTAINER);
	return json({ rules: await listRules(params.projectId) });
};

function parseRule(body: unknown): RuleInput {
	const b = (body ?? {}) as Record<string, unknown>;
	const name = String(b.name ?? '').trim();
	if (!name) throw error(400, 'Name is required');
	const trigger = b.trigger as RuleInput['trigger'];
	if (!trigger || typeof trigger.type !== 'string') throw error(400, 'A trigger is required');
	const actions = Array.isArray(b.actions) ? (b.actions as RuleInput['actions']) : [];
	if (!actions.length) throw error(400, 'At least one action is required');
	return {
		name,
		enabled: b.enabled === undefined ? true : !!b.enabled,
		trigger: { type: trigger.type, config: (trigger.config as Record<string, unknown>) ?? {} },
		conditions: Array.isArray(b.conditions) ? (b.conditions as RuleInput['conditions']) : [],
		actions
	};
}

export const POST: RequestHandler = async ({ params, locals, request }) => {
	await requireProjectAccess(locals.user, params.projectId, ACCESS.MAINTAINER);
	const rule = await createRule(params.projectId, parseRule(await request.json()));
	return json({ rule });
};
