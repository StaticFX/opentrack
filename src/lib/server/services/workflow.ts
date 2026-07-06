import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { enqueue } from '$lib/server/jobs';

export interface RuleInput {
	name: string;
	enabled?: boolean;
	trigger: { type: string; config: Record<string, unknown> };
	conditions: Array<{ type: string; value: string }>;
	actions: Array<{ type: string; config: Record<string, unknown> }>;
}

export async function listRules(projectId: string) {
	return db
		.select()
		.from(schema.workflowRules)
		.where(eq(schema.workflowRules.projectId, projectId))
		.orderBy(asc(schema.workflowRules.createdAt));
}

/** The project a rule belongs to (for authz), or null. */
export async function ruleProjectId(id: string): Promise<string | null> {
	const [r] = await db
		.select({ projectId: schema.workflowRules.projectId })
		.from(schema.workflowRules)
		.where(eq(schema.workflowRules.id, id))
		.limit(1);
	return r?.projectId ?? null;
}

export async function createRule(projectId: string, input: RuleInput) {
	const [row] = await db
		.insert(schema.workflowRules)
		.values({
			projectId,
			name: input.name,
			enabled: input.enabled ?? true,
			trigger: input.trigger,
			conditions: input.conditions,
			actions: input.actions
		})
		.returning();
	return row;
}

export async function updateRule(id: string, patch: Partial<RuleInput>) {
	await db
		.update(schema.workflowRules)
		.set({
			...(patch.name !== undefined ? { name: patch.name } : {}),
			...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
			...(patch.trigger !== undefined ? { trigger: patch.trigger } : {}),
			...(patch.conditions !== undefined ? { conditions: patch.conditions } : {}),
			...(patch.actions !== undefined ? { actions: patch.actions } : {}),
			updatedAt: new Date()
		})
		.where(eq(schema.workflowRules.id, id));
}

export async function deleteRule(id: string) {
	await db.delete(schema.workflowRules).where(eq(schema.workflowRules.id, id));
}

/**
 * Enqueue a workflow evaluation for a ticket action — but only when the project
 * actually has an enabled rule, so ruleless projects add zero jobs.
 */
export async function enqueueWorkflowEvent(
	projectId: string,
	trigger: string,
	ticketId: string,
	ctx: Record<string, unknown> = {}
): Promise<void> {
	// Best-effort: a rule evaluation must never break the user's ticket action.
	try {
		const [has] = await db
			.select({ id: schema.workflowRules.id })
			.from(schema.workflowRules)
			.where(and(eq(schema.workflowRules.projectId, projectId), eq(schema.workflowRules.enabled, true)))
			.limit(1);
		if (has) await enqueue('workflow:event', { projectId, trigger, ticketId, ctx });
	} catch (err) {
		console.warn('[workflow] enqueue failed (non-fatal):', err);
	}
}
