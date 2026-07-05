import '$lib/server/load-env';
import { bootstrapAdmin } from '$lib/server/auth/bootstrap';
import { findUserByEmail } from '$lib/server/auth/user';
import { closeDb } from '$lib/server/db';
import { env } from '$lib/server/env';
import { seedDemo } from '$lib/server/seed-demo';

async function main() {
	await bootstrapAdmin();

	// Seed demo data (only if no workspaces exist yet), owned by the admin.
	const email = env.bootstrapAdmin.email;
	const admin = email ? await findUserByEmail(email) : null;
	if (admin) {
		await seedDemo({
			id: admin.id,
			username: admin.username,
			displayName: admin.displayName,
			email: admin.email,
			avatarUrl: admin.avatarUrl,
			isAdmin: admin.isAdmin
		});
	} else {
		console.log('[seed] no admin user — set ADMIN_EMAIL/ADMIN_PASSWORD to seed demo data.');
	}

	console.log('[seed] done');
	await closeDb();
}

main().catch((err) => {
	console.error('[seed] failed:', err);
	process.exit(1);
});
