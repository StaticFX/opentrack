import { error } from '@sveltejs/kit';
import { ACCESS } from '$lib/server/permissions';
import { listForWorkspace } from '$lib/server/services/projects';
import {
	getProjectHeartbeat,
	listPublicActivity,
	type PublicActivityItem
} from '$lib/server/services/public';
import { getForUser } from '$lib/server/services/workspaces';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const ctx = await getForUser(locals.user, params.wsSlug);
	if (!ctx) throw error(404, 'Not found');
	if (ctx.access === ACCESS.NONE && ctx.workspace.visibility !== 'public') throw error(404, 'Not found');

	const rows = await listForWorkspace(locals.user, ctx.workspace, ctx.role);
	const projects = await Promise.all(
		rows.map(async (p) => {
			// Public pulse only for publicly-effective projects; private ones a
			// member can see in this list stay data-free on the public surface.
			const isPublic = ctx.workspace.visibility === 'public' && p.project.visibility !== 'private';
			return {
				slug: p.project.slug,
				name: p.project.name,
				description: p.project.description,
				color: p.project.color,
				icon: p.project.icon,
				stats: await getProjectHeartbeat(p.project.id, isPublic),
				activity: isPublic ? await listPublicActivity(p.project.id, true, 3) : []
			};
		})
	);

	const totals = {
		projects: projects.length,
		open: projects.reduce((n, p) => n + p.stats.open, 0),
		shipped: projects.reduce((n, p) => n + p.stats.shipped, 0)
	};

	const activity: Array<PublicActivityItem & { projectName: string; base: string }> = projects
		.flatMap((p) =>
			p.activity.map((a) => ({ ...a, projectName: p.name, base: `/${params.wsSlug}/${p.slug}` }))
		)
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
		.slice(0, 6);

	return {
		workspace: {
			slug: ctx.workspace.slug,
			name: ctx.workspace.name,
			description: ctx.workspace.description,
			icon: ctx.workspace.icon,
			color: ctx.workspace.color,
			avatarUrl: ctx.workspace.avatarUrl,
			publicHeadline: ctx.workspace.publicHeadline,
			publicTagline: ctx.workspace.publicTagline
		},
		projects: projects.map(({ activity: _drop, ...p }) => p),
		totals,
		activity
	};
};
