import { getConfig } from '$lib/server/config';
import { listForWorkspace } from '$lib/server/services/projects';
import { listPublic } from '$lib/server/services/workspaces';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { site } = await getConfig();
	const workspaces = await listPublic();
	const items = await Promise.all(
		workspaces.map(async (ws) => {
			const projects = await listForWorkspace(null, ws, null);
			return {
				slug: ws.slug,
				name: ws.name,
				description: ws.description,
				projects: projects.map((p) => ({
					slug: p.project.slug,
					name: p.project.name,
					description: p.project.description,
					color: p.project.color
				}))
			};
		})
	);
	// Only show workspaces that actually expose a public project.
	return { items: items.filter((w) => w.projects.length > 0), site };
};
