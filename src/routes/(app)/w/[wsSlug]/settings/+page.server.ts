import { error, fail, redirect } from '@sveltejs/kit';
import type { Visibility, WorkspaceRole } from '$lib/constants';
import { WORKSPACE_ROLES } from '$lib/constants';
import { env } from '$lib/server/env';
import { deleteWorkspaceInvite, generateInviteCode, listWorkspaceInvites } from '$lib/server/auth/invite';
import { normalizeScopes } from '$lib/apiScopes';
import { createApiKey, listApiKeys, revokeApiKey } from '$lib/server/services/api-keys';
import { githubConfigured } from '$lib/server/github/app';
import { listForWorkspace, removeInstallation } from '$lib/server/github/installations';
import { ACCESS, canManageWorkspace } from '$lib/server/permissions';
import {
	deleteWorkspace,
	getForUser,
	listMembers,
	removeMember,
	setMemberRole,
	updateWorkspace
} from '$lib/server/services/workspaces';
import type { Actions, PageServerLoad } from './$types';

async function requireManage(locals: App.Locals, wsSlug: string) {
	const ctx = await getForUser(locals.user, wsSlug);
	if (!ctx) throw error(404, 'Workspace not found');
	if (!canManageWorkspace(ctx.access)) throw error(403, 'You cannot manage this workspace.');
	return ctx;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const ctx = await requireManage(locals, params.wsSlug);
	const installations = await listForWorkspace(ctx.workspace.id);
	return {
		members: await listMembers(ctx.workspace.id),
		isOwner: ctx.access === ACCESS.OWNER,
		ownerId: ctx.workspace.ownerId,
		githubEnabled: await githubConfigured(),
		installations: installations.map((i) => ({
			id: i.id,
			accountLogin: i.accountLogin,
			accountType: i.accountType
		})),
		apiKeys: await listApiKeys(ctx.workspace.id),
		invites: await listWorkspaceInvites(ctx.workspace.id),
		origin: env.origin
	};
};

export const actions: Actions = {
	updateGeneral: async ({ request, locals, params }) => {
		await requireManage(locals, params.wsSlug);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		const icon = String(form.get('icon') ?? '').trim();
		const color = String(form.get('color') ?? '').trim();
		const avatarUrl = String(form.get('avatarUrl') ?? '').trim();
		const visibility = (String(form.get('visibility') ?? 'public') === 'private'
			? 'private'
			: 'public') as Visibility;
		if (!name) return fail(400, { error: 'Name is required.' });
		// Keep only the first emoji/grapheme so the icon stays a single glyph.
		const iconGlyph = icon ? [...icon][0] : '';
		if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
			return fail(400, { error: 'Accent color must be a hex value like #4f46e5.' });
		}
		if (avatarUrl && !/^https?:\/\//.test(avatarUrl)) {
			return fail(400, { error: 'Avatar must be an http(s) URL.' });
		}
		await updateWorkspace((await getForUser(locals.user, params.wsSlug))!.workspace.id, {
			name,
			description: description || null,
			icon: iconGlyph || null,
			color: color || null,
			avatarUrl: avatarUrl || null,
			visibility
		});
		return { saved: true };
	},

	updatePublic: async ({ request, locals, params }) => {
		await requireManage(locals, params.wsSlug);
		const form = await request.formData();
		const publicHeadline = String(form.get('publicHeadline') ?? '').trim();
		const publicTagline = String(form.get('publicTagline') ?? '').trim();
		await updateWorkspace((await getForUser(locals.user, params.wsSlug))!.workspace.id, {
			publicHeadline: publicHeadline || null,
			publicTagline: publicTagline || null
		});
		return { savedPublic: true };
	},

	generateInvite: async ({ request, locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug);
		const form = await request.formData();
		const role = String(form.get('role') ?? 'member') as WorkspaceRole;
		const maxUses = Math.max(1, Number(form.get('maxUses') ?? 1) || 1);
		if (!WORKSPACE_ROLES.includes(role)) return fail(400, { error: 'Invalid role.' });

		const { code } = await generateInviteCode({
			createdBy: locals.user!.id,
			scope: 'workspace',
			workspaceId: ctx.workspace.id,
			roleGrant: role,
			maxUses
		});
		return { inviteCode: code, inviteLink: `${env.origin}/auth/invite?code=${code}` };
	},

	deleteInvite: async ({ request, locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug);
		const id = String((await request.formData()).get('id') ?? '');
		if (id) await deleteWorkspaceInvite(id, ctx.workspace.id);
		return { inviteDeleted: true };
	},

	setRole: async ({ request, locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug);
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		const role = String(form.get('role') ?? '') as WorkspaceRole;
		if (userId === ctx.workspace.ownerId) return fail(400, { error: "Can't change the owner's role." });
		if (!WORKSPACE_ROLES.includes(role)) return fail(400, { error: 'Invalid role.' });
		await setMemberRole(ctx.workspace.id, userId, role);
		return { saved: true };
	},

	removeMember: async ({ request, locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug);
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		if (userId === ctx.workspace.ownerId) return fail(400, { error: "Can't remove the owner." });
		await removeMember(ctx.workspace.id, userId);
		return { saved: true };
	},

	createApiKey: async ({ request, locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim().slice(0, 60) || 'API key';
		const scopes = normalizeScopes(form.getAll('scope').map(String));
		const { raw, key } = await createApiKey(ctx.workspace.id, name, locals.user!.id, scopes.length ? scopes : ['read']);
		// The raw key is shown ONCE here and never again.
		return { apiKeyRaw: raw, apiKeyName: key.name };
	},

	revokeApiKey: async ({ request, locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug);
		const id = String((await request.formData()).get('id') ?? '');
		if (id) await revokeApiKey(ctx.workspace.id, id);
		return { apiKeyRevoked: true };
	},

	disconnectGithub: async ({ request, locals, params }) => {
		await requireManage(locals, params.wsSlug);
		const installationId = String((await request.formData()).get('installationId') ?? '');
		if (installationId) await removeInstallation(installationId);
		return { saved: true };
	},

	deleteWorkspace: async ({ locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug);
		if (ctx.access !== ACCESS.OWNER) throw error(403, 'Only the owner can delete a workspace.');
		await deleteWorkspace(ctx.workspace.id);
		throw redirect(303, '/dashboard');
	}
};
