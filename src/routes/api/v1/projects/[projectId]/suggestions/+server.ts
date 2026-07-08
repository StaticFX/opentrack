import { apiJson, apiProject, requireApiKey } from '$lib/server/apiv1';
import { listSuggestions } from '$lib/server/services/suggestions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, request, url }) => {
	const { workspaceId } = await requireApiKey(request, url, 'read');
	const project = await apiProject(workspaceId, params.projectId);
	const { cards } = await listSuggestions(project.id, { sort: 'top', status: 'all' });
	return apiJson({
		project: { slug: project.slug, name: project.name },
		suggestions: cards.map((s) => ({
			id: s.id,
			title: s.title,
			status: s.status,
			votes: s.votes,
			comments: s.comments,
			createdAt: s.createdAt
		}))
	});
};
