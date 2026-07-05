import { error } from '@sveltejs/kit';
import {
	ACCESS,
	canCreateProject,
	canManageWorkspace
} from '$lib/server/permissions';
import { listForWorkspace } from '$lib/server/services/projects';
import { getForUser } from '$lib/server/services/workspaces';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	const ctx = await getForUser(locals.user, params.wsSlug);
	if (!ctx) throw error(404, 'Workspace not found');
	// Inside the app, a private workspace requires membership.
	if (ctx.access === ACCESS.NONE && ctx.workspace.visibility !== 'public') {
		throw error(404, 'Workspace not found');
	}

	const projects = await listForWorkspace(locals.user, ctx.workspace, ctx.role);

	return {
		workspace: {
			id: ctx.workspace.id,
			slug: ctx.workspace.slug,
			name: ctx.workspace.name,
			description: ctx.workspace.description,
			visibility: ctx.workspace.visibility,
			icon: ctx.workspace.icon,
			color: ctx.workspace.color,
			avatarUrl: ctx.workspace.avatarUrl,
			publicHeadline: ctx.workspace.publicHeadline,
			publicTagline: ctx.workspace.publicTagline
		},
		wsRole: ctx.role,
		wsAccess: ctx.access,
		canCreateProject: canCreateProject(ctx.access),
		canManageWorkspace: canManageWorkspace(ctx.access),
		projects: projects.map((p) => ({
			slug: p.project.slug,
			name: p.project.name,
			description: p.project.description,
			color: p.project.color,
			icon: p.project.icon,
			visibility: p.visibility
		}))
	};
};
