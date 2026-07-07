import { error } from '@sveltejs/kit';
import { ACCESS, canManageProject } from '$lib/server/permissions';
import { getBySlugs } from '$lib/server/services/projects';
import { listReleases } from '$lib/server/services/releases';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	const ctx = await getBySlugs(locals.user, params.wsSlug, params.projectSlug);
	if (!ctx) throw error(404, 'Not found');
	if (ctx.level === ACCESS.NONE && ctx.visibility !== 'public') throw error(404, 'Not found');

	// Drive public tab visibility: hide Roadmap when disabled, Releases when empty.
	const hasReleases = (await listReleases(ctx.project.id, { publishedOnly: true })).length > 0;

	return {
		project: {
			id: ctx.project.id,
			slug: ctx.project.slug,
			name: ctx.project.name,
			description: ctx.project.description,
			color: ctx.project.color,
			allowPublicComments: ctx.project.allowPublicComments,
			roadmapEnabled: ctx.project.roadmapEnabled,
			githubRepo: ctx.project.githubRepo
		},
		workspace: { slug: ctx.workspace.slug, name: ctx.workspace.name },
		effectiveVisibility: ctx.visibility,
		hasReleases,
		level: ctx.level,
		canTriage: canManageProject(ctx.level),
		signedIn: !!locals.user
	};
};
