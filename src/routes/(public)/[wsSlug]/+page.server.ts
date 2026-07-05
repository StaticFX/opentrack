import { error } from '@sveltejs/kit';
import { ACCESS } from '$lib/server/permissions';
import { listForWorkspace } from '$lib/server/services/projects';
import { getForUser } from '$lib/server/services/workspaces';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const ctx = await getForUser(locals.user, params.wsSlug);
	if (!ctx) throw error(404, 'Not found');
	if (ctx.access === ACCESS.NONE && ctx.workspace.visibility !== 'public') throw error(404, 'Not found');

	const projects = await listForWorkspace(locals.user, ctx.workspace, ctx.role);
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
		projects: projects.map((p) => ({
			slug: p.project.slug,
			name: p.project.name,
			description: p.project.description,
			color: p.project.color
		}))
	};
};
