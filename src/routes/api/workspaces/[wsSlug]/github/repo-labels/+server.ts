import { error, json } from '@sveltejs/kit';
import { fetchRepoLabels } from '$lib/server/github/import';
import { listForWorkspace } from '$lib/server/github/installations';
import { canCreateProject } from '$lib/server/permissions';
import { getForUser } from '$lib/server/services/workspaces';
import type { RequestHandler } from './$types';

/** Labels of a repo the workspace can access — for the import settings modal. */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const ctx = await getForUser(locals.user, params.wsSlug);
	if (!ctx) throw error(404, 'Workspace not found');
	if (!canCreateProject(ctx.access)) throw error(403, 'Not allowed');

	const selected = url.searchParams.get('repo') ?? '';
	const sep = selected.indexOf('::');
	const installationId = sep >= 0 ? selected.slice(0, sep) : '';
	const fullName = sep >= 0 ? selected.slice(sep + 2) : '';
	if (!installationId || !fullName) throw error(400, 'repo is required');

	const installations = await listForWorkspace(ctx.workspace.id);
	if (!installations.some((i) => i.installationId === installationId)) {
		throw error(403, 'That repository is not available to this workspace.');
	}

	try {
		return json({ labels: await fetchRepoLabels(installationId, fullName) });
	} catch {
		return json({ labels: [] });
	}
};
