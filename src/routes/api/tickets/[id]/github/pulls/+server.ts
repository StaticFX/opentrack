import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireTicketAccess } from '$lib/server/access';
import { db, schema } from '$lib/server/db';
import { listOpenPRs } from '$lib/server/github/pr';
import { ACCESS } from '$lib/server/permissions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, url }) => {
	const { projectId } = await requireTicketAccess(locals.user, params.id, ACCESS.COLLABORATOR);
	const [project] = await db
		.select({
			id: schema.projects.id,
			githubRepo: schema.projects.githubRepo,
			githubInstallationId: schema.projects.githubInstallationId
		})
		.from(schema.projects)
		.where(eq(schema.projects.id, projectId))
		.limit(1);
	if (!project?.githubRepo || !project.githubInstallationId) {
		throw error(400, 'This project is not linked to a GitHub repository');
	}
	const pulls = await listOpenPRs(project, url.searchParams.get('q') ?? undefined);
	return json({ pulls });
};
