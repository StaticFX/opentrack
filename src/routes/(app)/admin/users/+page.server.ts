import { error, fail } from '@sveltejs/kit';
import { count, desc } from 'drizzle-orm';
import { generateInviteCode } from '$lib/server/auth/invite';
import { db, schema } from '$lib/server/db';
import { env } from '$lib/server/env';
import { listUsersAdmin, setUserStatus } from '$lib/server/services/users';
import type { Actions, PageServerLoad } from './$types';

function requireAdmin(locals: App.Locals) {
	if (!locals.user?.isAdmin) throw error(403, 'Admins only');
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const [users, [{ workspaces }], recentInvites] = await Promise.all([
		listUsersAdmin(),
		db.select({ workspaces: count() }).from(schema.workspaces),
		db
			.select({
				id: schema.inviteCodes.id,
				uses: schema.inviteCodes.uses,
				maxUses: schema.inviteCodes.maxUses,
				createdAt: schema.inviteCodes.createdAt
			})
			.from(schema.inviteCodes)
			.orderBy(desc(schema.inviteCodes.createdAt))
			.limit(8)
	]);

	return {
		users,
		recentInvites,
		stats: {
			users: users.length,
			internal: users.filter((u) => u.internal).length,
			workspaces
		}
	};
};

export const actions: Actions = {
	createInvite: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const maxUses = Math.max(1, Number(form.get('maxUses') ?? 1) || 1);
		const { code } = await generateInviteCode({
			createdBy: locals.user!.id,
			scope: 'global',
			roleGrant: 'member',
			maxUses
		});
		return { inviteCode: code, inviteLink: `${env.origin}/auth/invite?code=${code}`, maxUses };
	},

	setStatus: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		const status = String(form.get('status') ?? '');
		if (status !== 'active' && status !== 'suspended') return fail(400, { error: 'Bad status.' });
		if (userId === locals.user!.id) return fail(400, { error: "You can't disable your own account." });
		if (!userId) return fail(400, { error: 'Missing user.' });
		await setUserStatus(userId, status);
		return { statusChanged: userId };
	}
};
