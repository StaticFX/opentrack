import { eq } from 'drizzle-orm';
import { apiJson, apiProject, requireApiKey } from '$lib/server/apiv1';
import { db, schema } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, request, url }) => {
	const { workspaceId } = await requireApiKey(request, url, 'read');
	const project = await apiProject(workspaceId, params.projectId);

	const rows = await db
		.select({
			number: schema.tickets.number,
			title: schema.tickets.title,
			priority: schema.tickets.priority,
			closedAt: schema.tickets.closedAt,
			createdAt: schema.tickets.createdAt,
			updatedAt: schema.tickets.updatedAt,
			column: schema.boardColumns.name
		})
		.from(schema.tickets)
		.leftJoin(schema.boardColumns, eq(schema.tickets.columnId, schema.boardColumns.id))
		.where(eq(schema.tickets.projectId, project.id));

	return apiJson({
		project: { slug: project.slug, name: project.name },
		tickets: rows.map((t) => ({
			number: t.number,
			title: t.title,
			priority: t.priority,
			status: t.closedAt ? 'closed' : 'open',
			column: t.column,
			createdAt: t.createdAt,
			updatedAt: t.updatedAt
		}))
	});
};
