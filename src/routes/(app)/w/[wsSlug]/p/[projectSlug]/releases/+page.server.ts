import { error, fail, redirect } from '@sveltejs/kit';
import type { ReleaseStatus } from '$lib/constants';
import { canManageProject } from '$lib/server/permissions';
import { getBySlugs } from '$lib/server/services/projects';
import { createRelease, listReleases } from '$lib/server/services/releases';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const p = await parent();
	if (!p.canManageProject) throw error(403, 'Maintainers only');
	const releases = await listReleases(p.project.id);
	return {
		releases: releases.map((r) => ({
			id: r.id,
			version: r.version,
			name: r.name,
			status: r.status,
			releasedAt: r.releasedAt
		}))
	};
};

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		const ctx = await getBySlugs(locals.user, params.wsSlug, params.projectSlug);
		if (!ctx || !canManageProject(ctx.level)) throw error(403, 'Not allowed');
		const form = await request.formData();
		const version = String(form.get('version') ?? '').trim();
		if (!version) return fail(400, { error: 'Enter a version.' });
		const status = (String(form.get('status') ?? 'draft') === 'published' ? 'published' : 'draft') as ReleaseStatus;
		const id = await createRelease(ctx.project.id, { version, status });
		throw redirect(303, `/w/${params.wsSlug}/p/${params.projectSlug}/releases/${id}`);
	}
};
