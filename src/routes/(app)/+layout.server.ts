import { redirect } from '@sveltejs/kit';
import { hasInternalAccess } from '$lib/server/permissions';
import { listForUser } from '$lib/server/services/workspaces';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, `/auth/login?redirect=${encodeURIComponent(url.pathname)}`);
	}
	if (!(await hasInternalAccess(locals.user))) {
		throw redirect(302, '/auth/invite');
	}

	const workspaces = await listForUser(locals.user);
	return {
		user: locals.user,
		workspaces: workspaces.map((w) => ({
			id: w.workspace.id,
			slug: w.workspace.slug,
			name: w.workspace.name,
			icon: w.workspace.icon,
			color: w.workspace.color,
			avatarUrl: w.workspace.avatarUrl
		}))
	};
};
