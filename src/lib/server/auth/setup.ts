import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { env } from '$lib/server/env';
import { createAdminUser, type User } from './user';

// First-run setup. When an instance boots with no admin (and no ADMIN_PASSWORD
// override), we generate a single-use setup code, store its hash, and print the
// code to the logs. The operator claims the first admin at /setup with that code.

const TOKEN_KEY = 'setup.tokenHash';

// Memoized once an admin exists — flips true and never queries again, so the
// per-request first-run check in hooks is free on a live instance.
let initialized = false;

/** Normalize a code for hashing/compare: strip separators, upper-case. */
function normalize(code: string): string {
	return code.replace(/[^a-z0-9]/gi, '').toUpperCase();
}
function hashCode(code: string): string {
	return createHash('sha256').update(normalize(code)).digest('hex');
}

export async function adminExists(): Promise<boolean> {
	const [row] = await db
		.select({ id: schema.users.id })
		.from(schema.users)
		.where(eq(schema.users.isAdmin, true))
		.limit(1);
	return !!row;
}

/** True once the first admin exists (memoized). Drives the first-run redirect. */
export async function isInitialized(): Promise<boolean> {
	if (initialized) return true;
	if (await adminExists()) initialized = true;
	return initialized;
}

async function putSetting(key: string, value: string | null): Promise<void> {
	await db
		.insert(schema.settings)
		.values({ key, value, encrypted: false })
		.onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}
async function getSetting(key: string): Promise<string | null> {
	const [row] = await db
		.select({ value: schema.settings.value })
		.from(schema.settings)
		.where(eq(schema.settings.key, key))
		.limit(1);
	return row?.value ?? null;
}

/** Generate a fresh setup code, store its hash, and print it to the logs. */
export async function armSetupToken(): Promise<void> {
	// e.g. "A1B2-C3D4" — readable and easy to copy from a terminal.
	const raw = `${randomBytes(2).toString('hex')}-${randomBytes(2).toString('hex')}`.toUpperCase();
	await putSetting(TOKEN_KEY, hashCode(raw));

	const line = '━'.repeat(52);
	console.log(
		[
			'',
			line,
			'  OpenTrack — first-run setup',
			`  1. Open  ${env.origin}/setup`,
			`  2. Enter this one-time setup code:`,
			'',
			`       ${raw}`,
			'',
			'  It creates the first admin account and is single-use.',
			line,
			''
		].join('\n')
	);
}

/** Whether a claimable setup code is currently stored. */
export async function setupArmed(): Promise<boolean> {
	return (await getSetting(TOKEN_KEY)) !== null;
}

function verifyCode(submitted: string, storedHash: string): boolean {
	const a = Buffer.from(hashCode(submitted));
	const b = Buffer.from(storedHash);
	return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Claim the first admin with a valid setup code. Returns the new user, or null
 * if the code is wrong or an admin already exists (setup already completed).
 */
export async function claimAdmin(input: {
	username: string;
	code: string;
	password: string;
}): Promise<User | null> {
	if (await adminExists()) return null;
	const storedHash = await getSetting(TOKEN_KEY);
	if (!storedHash || !verifyCode(input.code, storedHash)) return null;

	const user = await createAdminUser({ username: input.username, password: input.password });
	await putSetting(TOKEN_KEY, null); // consume the code
	initialized = true;
	return user;
}
