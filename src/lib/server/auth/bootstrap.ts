import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { env } from '$lib/server/env';
import { createAdminUser } from './user';

/**
 * Create the initial admin on first boot if none exists. The username defaults
 * to ADMIN_USERNAME (or "admin") and the password to ADMIN_PASSWORD, or a
 * random one that is printed to the container logs so the operator can read it
 * from `docker logs` and sign in. No email required.
 */
export async function bootstrapAdmin(): Promise<void> {
	const [existing] = await db
		.select({ id: schema.users.id })
		.from(schema.users)
		.where(eq(schema.users.isAdmin, true))
		.limit(1);
	if (existing) return;

	const username = env.bootstrapAdmin.username || 'admin';
	const configured = env.bootstrapAdmin.password;
	const password = configured || randomBytes(9).toString('base64url'); // ~12 chars

	const user = await createAdminUser({ username, password, email: env.bootstrapAdmin.email || null });

	const line = '━'.repeat(52);
	console.log(
		[
			'',
			line,
			'  OpenTrack — initial admin account created',
			`  Username: ${user.username}`,
			configured ? '  Password: (from ADMIN_PASSWORD)' : `  Password: ${password}`,
			'  → Sign in, then change it in Account → Security.',
			line,
			''
		].join('\n')
	);
}
