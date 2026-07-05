import '$lib/server/load-env';

// Configure a bootstrap admin for this run before anything reads env.
process.env.ADMIN_EMAIL = 'admin@opentrack.test';
process.env.ADMIN_PASSWORD = 'correct-horse-battery';

import { eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import { bootstrapAdmin } from '$lib/server/auth/bootstrap';
import { generateInviteCode, redeemInviteCode } from '$lib/server/auth/invite';
import { verifyPassword } from '$lib/server/auth/password';
import type { SessionUser } from '$lib/server/auth/session';
import { findUserByEmail } from '$lib/server/auth/user';
import { getProjectAccess, hasInternalAccess, resolveVisibility, ACCESS } from '$lib/server/permissions';

function assert(cond: unknown, msg: string): void {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}

async function main() {
	// Clean slate for the entities this test touches.
	await db.delete(schema.users).where(eq(schema.users.email, 'admin@opentrack.test'));
	await db.delete(schema.users).where(eq(schema.users.username, 'invitee'));

	console.log('[1] bootstrap admin + password login');
	await bootstrapAdmin();
	const admin = await findUserByEmail('admin@opentrack.test');
	assert(admin?.isAdmin, 'admin created and flagged isAdmin');
	assert(await verifyPassword(admin!.passwordHash!, 'correct-horse-battery'), 'correct password verifies');
	assert(!(await verifyPassword(admin!.passwordHash!, 'wrong')), 'wrong password rejected');

	console.log('[2] invite generation + redemption');
	const { code } = await generateInviteCode({
		createdBy: admin!.id,
		scope: 'global',
		roleGrant: 'member',
		maxUses: 2
	});
	assert(/^[A-Z0-9-]+$/.test(code), `code formatted: ${code}`);

	const [invitee] = await db
		.insert(schema.users)
		.values({ username: 'invitee', displayName: 'Invitee' })
		.returning();
	const inviteeSession: SessionUser = {
		id: invitee.id,
		username: invitee.username,
		displayName: invitee.displayName,
		email: null,
		avatarUrl: null,
		isAdmin: false
	};

	assert(!(await hasInternalAccess(inviteeSession)), 'invitee has no internal access before redeeming');
	const r1 = await redeemInviteCode(inviteeSession, code);
	assert(r1.ok && !r1.alreadyRedeemed, 'redeem succeeds (first time)');
	assert(await hasInternalAccess(inviteeSession), 'invitee gains internal access after redeeming');
	const r2 = await redeemInviteCode(inviteeSession, code);
	assert(r2.ok && r2.alreadyRedeemed, 'redeem is idempotent per user');

	const [inviteRow] = await db
		.select({ uses: schema.inviteCodes.uses })
		.from(schema.inviteCodes)
		.where(eq(schema.inviteCodes.codeHash, schema.inviteCodes.codeHash))
		.limit(1);
	assert(inviteRow.uses === 1, `uses counted once despite double-redeem (uses=${inviteRow.uses})`);
	assert(!(await redeemInviteCode(inviteeSession, 'BOGUS-CODE')).ok, 'bogus code rejected');

	console.log('[3] visibility resolution');
	assert(resolveVisibility(['public', 'inherit', 'inherit']) === 'public', 'public → inherit → inherit = public');
	assert(resolveVisibility(['private', 'public']) === 'private', 'private parent caps public child');
	assert(resolveVisibility(['public', 'private']) === 'private', 'private child narrows public parent');

	console.log('[4] project access levels');
	const [ws] = await db
		.insert(schema.workspaces)
		.values({ slug: `smoke-ws-${Date.now()}`, name: 'Smoke WS', ownerId: admin!.id, visibility: 'public' })
		.returning();
	const [proj] = await db
		.insert(schema.projects)
		.values({ workspaceId: ws.id, slug: 'proj', name: 'Proj', visibility: 'inherit' })
		.returning();

	const adminSession: SessionUser = {
		id: admin!.id,
		username: admin!.username,
		displayName: admin!.displayName,
		email: admin!.email,
		avatarUrl: null,
		isAdmin: true
	};
	const ownerAccess = await getProjectAccess(adminSession, proj.id);
	assert(ownerAccess?.level === ACCESS.OWNER, 'workspace owner/admin gets OWNER access');
	const anonAccess = await getProjectAccess(null, proj.id);
	assert(anonAccess?.level === ACCESS.NONE && anonAccess.visibility === 'public', 'anonymous: NONE level, public visibility');
	const strangerAccess = await getProjectAccess(inviteeSession, proj.id);
	assert(strangerAccess?.level === ACCESS.NONE, 'non-member authenticated user: NONE level on this project');

	// Cleanup.
	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	await db.delete(schema.users).where(eq(schema.users.id, invitee.id));
	await db.delete(schema.users).where(eq(schema.users.id, admin!.id));
	await db.delete(schema.inviteCodes);

	console.log('\n[smoke-auth] ✓ all checks passed');
	await closeDb();
}

main().catch((err) => {
	console.error('\n[smoke-auth] FAILED:', err);
	process.exit(1);
});
