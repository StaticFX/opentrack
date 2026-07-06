import { error, fail, redirect } from '@sveltejs/kit';
import type { ProjectRole, Visibility } from '$lib/constants';
import { PROJECT_ROLES } from '$lib/constants';
import { asc, eq } from 'drizzle-orm';
import { env } from '$lib/server/env';
import { generateInviteCode } from '$lib/server/auth/invite';
import { db, schema } from '$lib/server/db';
import { getProjectDiscord, setProjectDiscord } from '$lib/server/discord/config';
import { listFields } from '$lib/server/services/custom-fields';
import { githubConfigured } from '$lib/server/github/app';
import { createStatusLabels } from '$lib/server/github/import';
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

/** Distinct board-column names (+ color + category) across the project's boards. */
async function projectColumns(
	projectId: string
): Promise<Array<{ name: string; color: string; category: string }>> {
	const rows = await db
		.select({ name: schema.boardColumns.name, color: schema.boardColumns.color, category: schema.boardColumns.category })
		.from(schema.boardColumns)
		.innerJoin(schema.boards, eq(schema.boardColumns.boardId, schema.boards.id))
		.where(eq(schema.boards.projectId, projectId))
		.orderBy(asc(schema.boardColumns.position));
	const seen = new Set<string>();
	const out: Array<{ name: string; color: string; category: string }> = [];
	for (const r of rows) if (!seen.has(r.name)) { seen.add(r.name); out.push({ name: r.name, color: r.color, category: r.category }); }
	return out;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const ctx = await requireManage(locals, params.wsSlug, params.projectSlug);
	const ghEnabled = await githubConfigured();
	const repos = ghEnabled ? await listWorkspaceRepos(ctx.workspace.id) : [];
	return {
		members: await listMembers(ctx.project.id),
		githubEnabled: ghEnabled,
		repos: repos.map((r) => ({ value: `${r.installationId}::${r.fullName}`, label: r.fullName })),
		linkedRepo: ctx.project.githubRepo,
		linkedInstallation: ctx.project.githubInstallationId,
		columns: await projectColumns(ctx.project.id),
		progressLabels: (ctx.project.githubProgressLabels as string[] | null) ?? [],
		closeColumns: (ctx.project.githubCloseColumns as string[] | null) ?? [],
		githubSync: {
			assignees: ctx.project.githubSyncAssignees,
			labels: ctx.project.githubSyncLabels,
			priority: ctx.project.githubSyncPriority,
			milestones: ctx.project.githubSyncMilestones
		},
		origin: env.origin,
		isPublic: ctx.visibility === 'public',
		fields: await listFields(ctx.project.id),
		discord: await (async () => {
			const d = await getProjectDiscord(ctx.project.id);
			// Never send the decrypted webhook URL to the browser.
			return { hasWebhook: !!d.webhookUrl, events: d.events };
		})()
	};
};

const DISCORD_WEBHOOK_RE = /^https:\/\/(?:[a-z]+\.)?discord(?:app)?\.com\/api\/webhooks\//i;

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
			.set({ githubInstallationId: null, githubRepo: null, githubProgressLabels: null })
			.where(eq(schema.projects.id, ctx.project.id));
		return { unlinked: true };
	},

	// Configure which board columns mirror to the linked issue as a
	// "Status: <col>" label (post-import; picks up newly added lanes).
	saveProgressLabels: async ({ request, locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug, params.projectSlug);
		const selected = (await request.formData()).getAll('progressColumn').map(String);
		await updateProject(ctx.project.id, { githubProgressLabels: selected.length ? selected : null });

		// Create the Status: labels on GitHub for any selected column (best-effort).
		let created = 0;
		if (ctx.project.githubRepo && ctx.project.githubInstallationId && selected.length) {
			const byName = new Map((await projectColumns(ctx.project.id)).map((c) => [c.name, c.color]));
			const cols = selected.map((n) => ({ name: n, color: byName.get(n) ?? '#6b7280' }));
			try {
				created = await createStatusLabels(ctx.project.githubInstallationId, ctx.project.githubRepo, cols);
			} catch {
				created = 0;
			}
		}
		return { progressSaved: true, created };
	},

	// Configure which board columns close the linked GitHub issue. Empty → fall
	// back to the column category (done / canceled).
	saveCloseColumns: async ({ request, locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug, params.projectSlug);
		const selected = (await request.formData()).getAll('closeColumn').map(String);
		await updateProject(ctx.project.id, { githubCloseColumns: selected.length ? selected : null });
		return { closeSaved: true };
	},

	// Toggle which GitHub facets sync for this project (assignees / labels /
	// priority / milestones). Unchecked checkboxes are simply absent.
	saveGithubSync: async ({ request, locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug, params.projectSlug);
		const form = await request.formData();
		await db
			.update(schema.projects)
			.set({
				githubSyncAssignees: form.get('syncAssignees') === 'on',
				githubSyncLabels: form.get('syncLabels') === 'on',
				githubSyncPriority: form.get('syncPriority') === 'on',
				githubSyncMilestones: form.get('syncMilestones') === 'on'
			})
			.where(eq(schema.projects.id, ctx.project.id));
		return { githubSyncSaved: true };
	},

	// Save the Discord webhook + which events announce to it. A blank URL field
	// leaves the existing webhook untouched (so you can edit events without
	// re-pasting the secret); use removeDiscord to clear it.
	saveDiscord: async ({ request, locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug, params.projectSlug);
		const form = await request.formData();
		const webhookRaw = String(form.get('webhookUrl') ?? '').trim();
		const events = form.getAll('event').map(String);
		const patch: { webhookUrl?: string | null; events?: string[] } = { events };
		if (webhookRaw) {
			if (!DISCORD_WEBHOOK_RE.test(webhookRaw)) {
				return fail(400, { discordError: "That doesn't look like a Discord webhook URL." });
			}
			patch.webhookUrl = webhookRaw;
		}
		await setProjectDiscord(ctx.project.id, patch);
		return { discordSaved: true };
	},

	removeDiscord: async ({ locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug, params.projectSlug);
		await setProjectDiscord(ctx.project.id, { webhookUrl: null });
		return { discordRemoved: true };
	},

	testDiscord: async ({ locals, params }) => {
		const ctx = await requireManage(locals, params.wsSlug, params.projectSlug);
		const cfg = await getProjectDiscord(ctx.project.id);
		if (!cfg.webhookUrl) return fail(400, { discordError: 'Add a webhook URL and save first.' });
		const { buildDiscordPayload, postDiscord } = await import('$lib/server/discord/send');
		const body = buildDiscordPayload(
			'ticket.created',
			{
				title: 'Test message from OpenTrack',
				description: 'If you can read this, your webhook is wired up correctly. 🎉',
				actor: locals.user?.displayName,
				url: `/${params.wsSlug}/${params.projectSlug}`
			},
			env.origin
		);
		const { ok, status } = await postDiscord(cfg.webhookUrl, body);
		if (!ok) return fail(400, { discordError: `Discord returned ${status}.` });
		return { discordTested: true };
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
