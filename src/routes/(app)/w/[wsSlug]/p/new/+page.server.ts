import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Visibility } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import { githubConfigured } from '$lib/server/github/app';
import { fetchRepoMeta } from '$lib/server/github/import';
import { listForWorkspace as listInstallations, listWorkspaceRepos } from '$lib/server/github/installations';
import { enqueue } from '$lib/server/jobs/queue';
import { canCreateProject } from '$lib/server/permissions';
import { createProject } from '$lib/server/services/projects';
import { getForUser } from '$lib/server/services/workspaces';
import type { Actions, PageServerLoad } from './$types';

const VIS: Visibility[] = ['inherit', 'public', 'private'];

export const load: PageServerLoad = async ({ locals, params }) => {
	const ctx = await getForUser(locals.user, params.wsSlug);
	if (!ctx) throw error(404, 'Workspace not found');

	// GitHub import is available when the App is configured AND this workspace
	// has at least one installation. Repo listing is best-effort (network).
	const configured = await githubConfigured();
	const installations = configured ? await listInstallations(ctx.workspace.id) : [];
	let repos: Array<{ value: string; label: string; private: boolean }> = [];
	if (installations.length) {
		try {
			const list = await listWorkspaceRepos(ctx.workspace.id);
			repos = list
				.map((r) => ({ value: `${r.installationId}::${r.fullName}`, label: r.fullName, private: r.private }))
				.sort((a, b) => a.label.localeCompare(b.label));
		} catch {
			repos = [];
		}
	}

	return {
		github: {
			configured,
			connected: installations.length > 0,
			repos
		}
	};
};

export const actions: Actions = {
	createBlank: async ({ request, locals, params }) => {
		const ctx = await getForUser(locals.user, params.wsSlug);
		if (!ctx) throw error(404, 'Workspace not found');
		if (!canCreateProject(ctx.access)) throw error(403, 'You cannot create projects here.');

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim() || undefined;
		const color = String(form.get('color') ?? '') || undefined;
		const iconRaw = String(form.get('icon') ?? '').trim();
		const icon = iconRaw ? [...iconRaw][0] : undefined; // keep a single glyph
		const vis = String(form.get('visibility') ?? 'inherit');
		const visibility = (VIS.includes(vis as Visibility) ? vis : 'inherit') as Visibility;

		if (!name) return fail(400, { error: 'Enter a project name.', name: '' });

		const project = await createProject(locals.user!, ctx.workspace, {
			name,
			description,
			color,
			icon,
			visibility
		});
		throw redirect(303, `/w/${params.wsSlug}/p/${project.slug}`);
	},

	importGithub: async ({ request, locals, params }) => {
		const ctx = await getForUser(locals.user, params.wsSlug);
		if (!ctx) throw error(404, 'Workspace not found');
		if (!canCreateProject(ctx.access)) throw error(403, 'You cannot create projects here.');
		if (!(await githubConfigured())) return fail(400, { importError: 'GitHub is not configured on this instance.' });

		const form = await request.formData();
		const selected = String(form.get('repo') ?? '');
		const sep = selected.indexOf('::');
		const installationId = sep >= 0 ? selected.slice(0, sep) : '';
		const fullName = sep >= 0 ? selected.slice(sep + 2) : '';
		if (!installationId || !fullName) return fail(400, { importError: 'Pick a repository to import.' });

		// The chosen installation must belong to this workspace.
		const installations = await listInstallations(ctx.workspace.id);
		if (!installations.some((i) => i.installationId === installationId)) {
			return fail(403, { importError: 'That repository is not available to this workspace.' });
		}

		// Seed the project from the repo's name + description, then link + import.
		let meta: { name: string; description: string | null };
		try {
			meta = await fetchRepoMeta(installationId, fullName);
		} catch {
			return fail(502, { importError: 'Could not reach GitHub for that repository.' });
		}

		// Import settings from the modal. Unchecked checkboxes are simply absent.
		// `configured` distinguishes "modal submitted with none selected" (import
		// nothing) from the plain button (import everything, backwards-compatible).
		const configured = form.get('configured') === '1';
		const issueLabels = form.getAll('issueLabel').map(String);
		const progressColumns = form.getAll('progressColumn').map(String);
		const options = {
			importIssues: configured ? form.get('importIssues') === 'on' : true,
			importPrs: configured ? form.get('importPrs') === 'on' : true,
			importReleases: configured ? form.get('importReleases') === 'on' : true,
			// When configured, only the checked labels; otherwise all (null).
			issueLabels: configured ? issueLabels : null,
			progressColumns
		};

		const project = await createProject(locals.user!, ctx.workspace, {
			name: meta.name,
			description: meta.description ?? undefined
		});
		await db
			.update(schema.projects)
			.set({
				githubInstallationId: installationId,
				githubRepo: fullName,
				githubProgressLabels: progressColumns.length ? progressColumns : null
			})
			.where(eq(schema.projects.id, project.id));

		// Issues/labels can be many — pull them in the background worker.
		await enqueue('github:import', {
			projectId: project.id,
			installationId,
			repoFullName: fullName,
			options
		});

		throw redirect(303, `/w/${params.wsSlug}/p/${project.slug}`);
	}
};
