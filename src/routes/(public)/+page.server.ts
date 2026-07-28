import { getConfig } from '$lib/server/config';
import { listForWorkspace } from '$lib/server/services/projects';
import {
	getProjectHeartbeat,
	listPublicActivity,
	type PublicActivityItem
} from '$lib/server/services/public';
import { listPublic } from '$lib/server/services/workspaces';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { site } = await getConfig();
	const workspaces = await listPublic();

	const items = await Promise.all(
		workspaces.map(async (ws) => {
			const projects = await listForWorkspace(null, ws, null);
			const withStats = await Promise.all(
				projects.map(async (p) => ({
					slug: p.project.slug,
					name: p.project.name,
					description: p.project.description,
					color: p.project.color,
					icon: p.project.icon,
					stats: await getProjectHeartbeat(p.project.id, true),
					activity: await listPublicActivity(p.project.id, true, 3)
				}))
			);
			return { slug: ws.slug, name: ws.name, description: ws.description, projects: withStats };
		})
	);
	const visible = items.filter((w) => w.projects.length > 0);

	// Instance pulse: honest aggregate numbers, no adjectives.
	const allProjects = visible.flatMap((w) => w.projects);
	const totals = {
		projects: allProjects.length,
		open: allProjects.reduce((n, p) => n + p.stats.open, 0),
		shipped: allProjects.reduce((n, p) => n + p.stats.shipped, 0),
		lastActivityAt: allProjects.reduce<Date | null>((latest, p) => {
			const t = p.stats.lastActivityAt;
			return t && (!latest || new Date(t) > new Date(latest)) ? t : latest;
		}, null)
	};

	// One feed across the whole workshop wall, newest first.
	const activity: Array<PublicActivityItem & { projectName: string; base: string }> = visible
		.flatMap((w) =>
			w.projects.flatMap((p) =>
				p.activity.map((a) => ({ ...a, projectName: p.name, base: `/${w.slug}/${p.slug}` }))
			)
		)
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
		.slice(0, 8);

	return {
		items: visible.map((w) => ({
			...w,
			projects: w.projects.map(({ activity: _drop, ...p }) => p)
		})),
		totals,
		activity,
		site
	};
};
