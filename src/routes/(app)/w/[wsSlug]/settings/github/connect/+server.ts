import { error, redirect } from '@sveltejs/kit';
import { githubConfigured, installUrl } from '$lib/server/github/app';
import { signState } from '$lib/server/github/state';
import { canManageWorkspace } from '$lib/server/permissions';
import { getForUser } from '$lib/server/services/workspaces';
import type { RequestHandler } from './$types';

// Starts the GitHub App installation flow for this workspace.
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!(await githubConfigured())) throw error(503, 'GitHub App not configured on this instance.');
	const ctx = await getForUser(locals.user, params.wsSlug);
	if (!ctx || !canManageWorkspace(ctx.access)) throw error(403, 'Not allowed');
	throw redirect(302, await installUrl(signState(ctx.workspace.id)));
};
