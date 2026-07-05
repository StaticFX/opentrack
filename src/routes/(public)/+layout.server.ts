import { getConfig } from '$lib/server/config';
import { ACCESS } from '$lib/server/permissions';
import { getForUser } from '$lib/server/services/workspaces';
import type { LayoutServerLoad } from './$types';

// Public area — no auth required. Expose the current user (if any) for the header,
// plus (when the URL is scoped to a workspace) that workspace's branding so the
// header + footer show the workspace's own logo/name instead of "OpenTrack".
export const load: LayoutServerLoad = async ({ locals, url }) => {
	const seg = url.pathname.split('/')[1] ?? '';

	let brand: {
		slug: string;
		name: string;
		icon: string | null;
		color: string | null;
		avatarUrl: string | null;
	} | null = null;

	if (seg) {
		const ctx = await getForUser(locals.user, seg);
		// Only brand for a workspace the visitor can actually see.
		if (ctx && (ctx.workspace.visibility === 'public' || ctx.access !== ACCESS.NONE)) {
			brand = {
				slug: ctx.workspace.slug,
				name: ctx.workspace.name,
				icon: ctx.workspace.icon,
				color: ctx.workspace.color,
				avatarUrl: ctx.workspace.avatarUrl
			};
		}
	}

	const { site } = await getConfig();
	return {
		user: locals.user
			? { displayName: locals.user.displayName, avatarUrl: locals.user.avatarUrl }
			: null,
		brand,
		siteName: site.name
	};
};
