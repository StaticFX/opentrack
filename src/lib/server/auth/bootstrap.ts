import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { env } from '$lib/server/env';
import { createAdminUser } from './user';

/**
 * Create the initial admin from ADMIN_EMAIL/ADMIN_PASSWORD if configured and no
 * admin exists yet. Safe to call repeatedly (no-op once an admin is present).
 */
export async function bootstrapAdmin(): Promise<void> {
	const { email, password } = env.bootstrapAdmin;
	if (!email || !password) return;

	const [existing] = await db
		.select({ id: schema.users.id })
		.from(schema.users)
		.where(eq(schema.users.isAdmin, true))
		.limit(1);
	if (existing) return;

	await createAdminUser(email, password);
	console.log(`[bootstrap] created initial admin: ${email}`);
}
