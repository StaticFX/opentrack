import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { getApp, githubConfigured } from '$lib/server/github/app';
import { storeInstallation } from '$lib/server/github/installations';
import { verifyState } from '$lib/server/github/state';
import type { RequestHandler } from './$types';

// GitHub redirects here after the App is installed (the App's "Setup URL").
export const GET: RequestHandler = async ({ url }) => {
	if (!(await githubConfigured())) throw error(503, 'GitHub App not configured');

	const installationId = url.searchParams.get('installation_id');
	const workspaceId = verifyState(url.searchParams.get('state'));
	if (!installationId || !workspaceId) throw error(400, 'Invalid setup callback');

	const res = await (await getApp()).octokit.request('GET /app/installations/{installation_id}', {
		installation_id: Number(installationId)
	});
	const account = res.data.account as { login?: string; type?: string } | null;

	await storeInstallation({
		workspaceId,
		installationId,
		accountLogin: account?.login ?? 'unknown',
		accountType: account?.type ?? null
	});

	const [ws] = await db
		.select({ slug: schema.workspaces.slug })
		.from(schema.workspaces)
		.where(eq(schema.workspaces.id, workspaceId))
		.limit(1);
	throw redirect(302, ws ? `/w/${ws.slug}/settings` : '/dashboard');
};
