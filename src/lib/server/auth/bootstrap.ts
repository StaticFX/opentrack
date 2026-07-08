import { env } from '$lib/server/env';
import { createAdminUser } from './user';
import { adminExists, armSetupToken } from './setup';

/**
 * On first boot, prepare the first admin. Two paths:
 *
 *  - **Default (interactive):** no admin and no `ADMIN_PASSWORD` → arm the
 *    first-run setup flow. A one-time code is printed to the logs; the operator
 *    creates their account at `/setup` (name + code, then their own password).
 *  - **Non-interactive override:** if `ADMIN_PASSWORD` is set, create the admin
 *    directly (for automation / unattended installs).
 */
export async function bootstrapAdmin(): Promise<void> {
	if (await adminExists()) return;

	if (env.bootstrapAdmin.password) {
		const username = env.bootstrapAdmin.username || 'admin';
		const user = await createAdminUser({
			username,
			password: env.bootstrapAdmin.password,
			email: env.bootstrapAdmin.email || null
		});
		const line = '━'.repeat(52);
		console.log(
			[
				'',
				line,
				'  OpenTrack — initial admin account created (from ADMIN_PASSWORD)',
				`  Username: ${user.username}`,
				'  → Sign in, then change it in Account → Security.',
				line,
				''
			].join('\n')
		);
		return;
	}

	await armSetupToken();
}
