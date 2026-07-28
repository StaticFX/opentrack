import { error } from '@sveltejs/kit';
import { ACCESS, canManageProject } from '$lib/server/permissions';
import { listBoards } from '$lib/server/services/boards';
import { getBySlugs } from '$lib/server/services/projects';
import { listReleases } from '$lib/server/services/releases';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	const ctx = await getBySlugs(locals.user, params.wsSlug, params.projectSlug);
	if (!ctx) throw error(404, 'Not found');
	if (ctx.level === ACCESS.NONE && ctx.visibility !== 'public') throw error(404, 'Not found');

	// Drive public tab visibility: hide Roadmap when disabled, Releases when empty.
	// The first board's id is hoisted here — the overview, board page, and the
	// live SSE subscriptions all need it.
	const [releases, boards] = await Promise.all([
		listReleases(ctx.project.id, { publishedOnly: true }),
		listBoards(ctx.project.id)
	]);
	const hasReleases = releases.length > 0;
	const boardId = boards[0]?.id ?? null;

	return {
		project: {
			id: ctx.project.id,
			slug: ctx.project.slug,
			name: ctx.project.name,
			description: ctx.project.description,
			color: ctx.project.color,
			icon: ctx.project.icon,
			allowPublicComments: ctx.project.allowPublicComments,
			roadmapEnabled: ctx.project.roadmapEnabled,
			githubRepo: ctx.project.githubRepo
		},
		workspace: { slug: ctx.workspace.slug, name: ctx.workspace.name },
		effectiveVisibility: ctx.visibility,
		hasReleases,
		boardId,
		level: ctx.level,
		canTriage: canManageProject(ctx.level),
		signedIn: !!locals.user
	};
};
