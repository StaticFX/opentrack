import { error } from '@sveltejs/kit';
import { ACCESS, canManageProject } from '$lib/server/permissions';
import { getBySlugs } from '$lib/server/services/projects';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	const ctx = await getBySlugs(locals.user, params.wsSlug, params.projectSlug);
	if (!ctx) throw error(404, 'Not found');
	if (ctx.level === ACCESS.NONE && ctx.visibility !== 'public') throw error(404, 'Not found');

	return {
		project: {
			id: ctx.project.id,
			slug: ctx.project.slug,
			name: ctx.project.name,
			description: ctx.project.description,
			color: ctx.project.color,
			allowPublicComments: ctx.project.allowPublicComments,
			githubRepo: ctx.project.githubRepo
		},
		workspace: { slug: ctx.workspace.slug, name: ctx.workspace.name },
		effectiveVisibility: ctx.visibility,
		level: ctx.level,
		canTriage: canManageProject(ctx.level),
		signedIn: !!locals.user
	};
};
