import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireProjectAccess } from '$lib/server/access';
import { db, schema } from '$lib/server/db';
import type { RequestHandler } from './$types';

/** Users assignable to a ticket: project members + workspace members. */
export const GET: RequestHandler = async ({ params, locals }) => {
	await requireProjectAccess(locals.user, params.projectId);

	const [proj] = await db
		.select({ workspaceId: schema.projects.workspaceId })
		.from(schema.projects)
		.where(eq(schema.projects.id, params.projectId))
		.limit(1);

	const byId = new Map<string, { userId: string; displayName: string; avatarUrl: string | null }>();

	const projMembers = await db
		.select({
			userId: schema.users.id,
			displayName: schema.users.displayName,
			avatarUrl: schema.users.avatarUrl
		})
		.from(schema.projectMembers)
		.innerJoin(schema.users, eq(schema.projectMembers.userId, schema.users.id))
		.where(eq(schema.projectMembers.projectId, params.projectId));
	for (const m of projMembers) byId.set(m.userId, m);

	if (proj) {
		const wsMembers = await db
			.select({
				userId: schema.users.id,
				displayName: schema.users.displayName,
				avatarUrl: schema.users.avatarUrl
			})
			.from(schema.workspaceMembers)
			.innerJoin(schema.users, eq(schema.workspaceMembers.userId, schema.users.id))
			.where(eq(schema.workspaceMembers.workspaceId, proj.workspaceId));
		for (const m of wsMembers) byId.set(m.userId, m);
	}

	return json({ members: [...byId.values()] });
};
