import { error, fail, redirect } from '@sveltejs/kit';
import type { ProjectRole, Visibility } from '$lib/constants';
import { PROJECT_ROLES } from '$lib/constants';
import { eq } from 'drizzle-orm';
import { env } from '$lib/server/env';
import { generateInviteCode } from '$lib/server/auth/invite';
import { db, schema } from '$lib/server/db';
import { githubConfigured } from '$lib/server/github/app';
import { listWorkspaceRepos } from '$lib/server/github/installations';
import { canManageProject } from '$lib/server/permissions';
import {
	deleteProject,
	getBySlugs,
	listMembers,
	removeMember,
	setMemberRole,
	updateProject
} from '$lib/server/services/projects';
import type { Actions, PageServerLoad } from './$types';

async function requireManage(locals: App.Locals, wsSlug: string, projectSlug: string) {
	const ctx = await getBySlugs(locals.user, wsSlug, projectSlug);
	if (!ctx) throw error(404, 'Project not found');
	if (!canManageProject(ctx.level)) throw error(403, 'You cannot manage this project.');
	return ctx;
}

const VIS: Visibility[] = ['inherit', 'public', 'private'];

export const load: PageServerLoad = async ({ locals, params }) => {
	const ctx = await requireManage(locals, params.wsSlug, params.projectSlug);
	const ghEnabled = await githubConfigured();
	const repos = ghEnabled ? await listWorkspaceRepos(ctx.workspace.id) : [];
	return {
		members: await listMembers(ctx.project.id),
		githubEnabled: ghEnabled,
		repos: repos.map((r) => ({ value: `${r.installationId}::${r.fullName}`, label: r.fullName })),
		linkedRepo: ctx.project.githubRepo,
		linkedInstallation: ctx.project.githubInstallationId
	};
};

export const actions: Actions = {
	updateGeneral: async ({ request, locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug, params.projectSlug);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		const color = String(form.get('color') ?? '') || null;
		const iconRaw = String(form.get('icon') ?? '').trim();
		const icon = iconRaw ? [...iconRaw][0] : null; // keep a single glyph
		const vis = String(form.get('visibility') ?? 'inherit');
		const visibility = (VIS.includes(vis as Visibility) ? vis : 'inherit') as Visibility;
		const allowPublicComments = form.get('allowPublicComments') === 'on';
		if (!name) return fail(400, { error: 'Name is required.' });

		await updateProject(ctx.project.id, {
			name,
			description: description || null,
			color,
			icon,
			visibility,
			allowPublicComments
		});
		return { saved: true };
	},

	linkRepo: async ({ request, locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug, params.projectSlug);
		const selected = String((await request.formData()).get('repo') ?? '');
		const [installationId, ...rest] = selected.split('::');
		const fullName = rest.join('::');
		if (!installationId || !fullName) return fail(400, { error: 'Pick a repository.' });
		await db
			.update(schema.projects)
			.set({ githubInstallationId: installationId, githubRepo: fullName })
			.where(eq(schema.projects.id, ctx.project.id));
		return { linked: true };
	},

	unlinkRepo: async ({ locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug, params.projectSlug);
		await db
			.update(schema.projects)
			.set({ githubInstallationId: null, githubRepo: null })
			.where(eq(schema.projects.id, ctx.project.id));
		return { unlinked: true };
	},

	generateInvite: async ({ request, locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug, params.projectSlug);
		const form = await request.formData();
		const role = String(form.get('role') ?? 'collaborator') as ProjectRole;
		const maxUses = Math.max(1, Number(form.get('maxUses') ?? 1) || 1);
		if (!PROJECT_ROLES.includes(role)) return fail(400, { error: 'Invalid role.' });

		const { code } = await generateInviteCode({
			createdBy: locals.user!.id,
			scope: 'project',
			projectId: ctx.project.id,
			workspaceId: ctx.workspace.id,
			roleGrant: role,
			maxUses
		});
		return { inviteCode: code, inviteLink: `${env.origin}/auth/invite?code=${code}` };
	},

	setRole: async ({ request, locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug, params.projectSlug);
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		const role = String(form.get('role') ?? '') as ProjectRole;
		if (!PROJECT_ROLES.includes(role)) return fail(400, { error: 'Invalid role.' });
		await setMemberRole(ctx.project.id, userId, role);
		return { saved: true };
	},

	removeMember: async ({ request, locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug, params.projectSlug);
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		await removeMember(ctx.project.id, userId);
		return { saved: true };
	},

	deleteProject: async ({ locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug, params.projectSlug);
		await deleteProject(ctx.project.id);
		throw redirect(303, `/w/${params.wsSlug}`);
	}
};
