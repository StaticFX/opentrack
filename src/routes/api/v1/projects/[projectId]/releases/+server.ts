import { apiJson, apiProject, requireApiKey } from '$lib/server/apiv1';
import { getReleaseDetail, listReleases } from '$lib/server/services/releases';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, request, url }) => {
	const { workspaceId } = await requireApiKey(request, url);
	const project = await apiProject(workspaceId, params.projectId);
	const published = await listReleases(project.id, { publishedOnly: true });
	const details = (await Promise.all(published.map((r) => getReleaseDetail(r.id)))).filter(Boolean);
	return apiJson({
		project: { slug: project.slug, name: project.name },
		releases: details.map((d) => ({
			version: d!.release.version,
			name: d!.release.name,
			notes: d!.release.notes,
			releasedAt: d!.release.releasedAt,
			links: d!.links.map((l) => ({ label: l.label, url: l.url, type: l.type })),
			tickets: d!.tickets.map((t) => ({ number: t.number, title: t.title }))
		}))
	});
};
