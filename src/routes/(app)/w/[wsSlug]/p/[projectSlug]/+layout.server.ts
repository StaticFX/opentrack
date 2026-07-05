import { error } from '@sveltejs/kit';
import {
	ACCESS,
	canEditProjectContent,
	canManageProject
} from '$lib/server/permissions';
import { listBoards } from '$lib/server/services/boards';
import { getBySlugs } from '$lib/server/services/projects';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	const ctx = await getBySlugs(locals.user, params.wsSlug, params.projectSlug);
	if (!ctx) throw error(404, 'Project not found');
	if (ctx.level === ACCESS.NONE && ctx.visibility !== 'public') {
		throw error(404, 'Project not found');
	}

	const boards = await listBoards(ctx.project.id);

	return {
		project: {
			id: ctx.project.id,
			slug: ctx.project.slug,
			name: ctx.project.name,
			description: ctx.project.description,
			color: ctx.project.color,
			icon: ctx.project.icon,
			visibility: ctx.project.visibility,
			allowPublicComments: ctx.project.allowPublicComments,
			githubRepo: ctx.project.githubRepo
		},
		projectLevel: ctx.level,
		projectVisibility: ctx.visibility,
		canManageProject: canManageProject(ctx.level),
		canEditContent: canEditProjectContent(ctx.level),
		boards: boards.map((b) => ({ id: b.id, name: b.name }))
	};
};
