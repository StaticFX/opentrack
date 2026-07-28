import '$lib/server/load-env';
import { eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { logActivity } from '$lib/server/services/activity';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { createProject } from '$lib/server/services/projects';
import {
	getPublicPulse,
	listNowBuilding,
	listPublicActivity,
	listPublicMilestones,
	listRecentlyShipped,
	listTopIdeas
} from '$lib/server/services/public';
import { releaseForTicket } from '$lib/server/services/releases';
import { createSuggestion } from '$lib/server/services/suggestions';
import { createTicket, getConvertedTicketSummary, moveTicket } from '$lib/server/services/tickets';
import { toggleVote } from '$lib/server/services/votes';
import { createWorkspace } from '$lib/server/services/workspaces';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}

async function main() {
	const [u] = await db
		.insert(schema.users)
		.values({ username: `pub-${Date.now()}`, displayName: 'Pubby', avatarUrl: 'https://a.example/x.png' })
		.returning();
	const user: SessionUser = { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };

	const ws = await createWorkspace(user, { name: 'Pub WS' });
	const project = await createProject(user, { ...ws }, { name: 'Pub Proj' });
	const [board] = await listBoards(project.id);
	const cols = await getBoardColumns(board.id);
	const todo = cols.find((c) => c.category === 'todo')!;
	const prog = cols.find((c) => c.category === 'in_progress')!;
	const done = cols.find((c) => c.category === 'done')!;

	// Tickets: open public, in-progress public, shipped public, private (in prog),
	// archived (in prog) — the last two must never surface anywhere public.
	const tOpen = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: todo.id, title: 'Open thing' });
	const tBuild = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: prog.id, title: 'Building thing' });
	const tShip = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: prog.id, title: 'Ship me' });
	await moveTicket(tShip.id, done.id);
	const tPriv = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: prog.id, title: 'SECRET build' });
	await db.update(schema.tickets).set({ visibility: 'private' }).where(eq(schema.tickets.id, tPriv.id));
	const tArch = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: prog.id, title: 'ARCHIVED build' });
	await db.update(schema.tickets).set({ archivedAt: new Date() }).where(eq(schema.tickets.id, tArch.id));
	// A private ticket that is also closed — must stay out of "recently shipped".
	const tPrivDone = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: prog.id, title: 'SECRET shipped' });
	await db.update(schema.tickets).set({ visibility: 'private' }).where(eq(schema.tickets.id, tPrivDone.id));
	await moveTicket(tPrivDone.id, done.id);

	// Suggestions: one public, one hidden.
	const sPub = await createSuggestion(user, project.id, { title: 'Public idea' });
	const sHidden = await createSuggestion(user, project.id, { title: 'HIDDEN idea' });
	await db.update(schema.suggestions).set({ isPublic: false }).where(eq(schema.suggestions.id, sHidden));
	await toggleVote('suggestion', sPub, { userId: user.id });

	// Milestone with one public open, one public closed, one private ticket.
	const [ms] = await db
		.insert(schema.milestones)
		.values({ projectId: project.id, title: 'v1', state: 'open' })
		.returning();
	await db.update(schema.tickets).set({ milestoneId: ms.id }).where(eq(schema.tickets.id, tOpen.id));
	await db.update(schema.tickets).set({ milestoneId: ms.id }).where(eq(schema.tickets.id, tShip.id));
	await db.update(schema.tickets).set({ milestoneId: ms.id }).where(eq(schema.tickets.id, tPriv.id));

	// Releases: one published shipping tShip, one draft.
	const [rel] = await db
		.insert(schema.releases)
		.values({ projectId: project.id, version: 'v1.0.0', status: 'published', releasedAt: new Date() })
		.returning();
	await db.insert(schema.releaseTickets).values({ releaseId: rel.id, ticketId: tShip.id });
	const [draft] = await db
		.insert(schema.releases)
		.values({ projectId: project.id, version: 'v9.9.9-draft', status: 'draft' })
		.returning();

	// Activity rows: public ticket, private ticket, public suggestion, hidden
	// suggestion, published release, draft release, and an off-whitelist type.
	await logActivity({ projectId: project.id, subjectType: 'ticket', subjectId: tOpen.id, actorId: user.id, type: 'ticket.created' });
	await logActivity({ projectId: project.id, subjectType: 'ticket', subjectId: tPriv.id, actorId: user.id, type: 'ticket.created' });
	await logActivity({ projectId: project.id, subjectType: 'suggestion', subjectId: sPub, actorId: user.id, type: 'suggestion.created' });
	await logActivity({ projectId: project.id, subjectType: 'suggestion', subjectId: sHidden, actorId: user.id, type: 'suggestion.created' });
	await logActivity({ projectId: project.id, subjectType: 'release', subjectId: rel.id, actorId: user.id, type: 'release.published' });
	await logActivity({ projectId: project.id, subjectType: 'release', subjectId: draft.id, actorId: user.id, type: 'release.published' });
	await logActivity({ projectId: project.id, subjectType: 'ticket', subjectId: tOpen.id, actorId: user.id, type: 'ticket.moved' });

	console.log('[1] getPublicPulse');
	const pulse = await getPublicPulse(project.id, true);
	// Public tickets: tOpen, tBuild, tShip (closed). Private + archived excluded.
	assert(pulse.stats.totalTickets === 3, `total counts public only (got ${pulse.stats.totalTickets})`);
	assert(pulse.stats.openTickets === 2 && pulse.stats.closedTickets === 1, 'open/closed split right');
	assert(pulse.stats.openIdeas === 1, 'openIdeas counts public open suggestions only');
	assert(pulse.stats.releases === 1, 'releases counts published only');
	assert(pulse.stats.contributors >= 1, 'contributors counted');
	assert(pulse.weekly.length === 12, '12 weekly bins');
	assert(pulse.weekly.at(-1)!.opened === 3, 'this week opened=3 (public only)');
	assert(pulse.velocity.openedLast30d === 3 && pulse.velocity.closedLast30d === 1, '30d velocity public only');
	assert(pulse.lastActivityAt != null, 'lastActivityAt set');

	const privatePulse = await getPublicPulse(project.id, false);
	assert(privatePulse.stats.totalTickets === 0, 'isPublic=false → zero ticket stats');

	console.log('[2] listRecentlyShipped');
	const shipped = await listRecentlyShipped(project.id, true);
	assert(shipped.length === 1 && shipped[0].number === tShip.number, 'only the public closed ticket');
	assert(!shipped.some((s) => s.title.includes('SECRET')), 'private closed ticket excluded');
	assert((await listRecentlyShipped(project.id, false)).length === 0, 'isPublic=false → empty');

	console.log('[3] listNowBuilding');
	const building = await listNowBuilding(project.id, true);
	assert(building.length === 1 && building[0].number === tBuild.number, 'only public in-progress ticket');
	assert(building[0].columnName === prog.name, 'column name resolved');
	assert((await listNowBuilding(project.id, false)).length === 0, 'isPublic=false → empty');

	console.log('[4] listPublicActivity');
	const act = await listPublicActivity(project.id, true);
	const titles = act.map((a) => a.ticketTitle ?? a.suggestionTitle ?? a.releaseVersion);
	assert(titles.includes('Open thing'), 'public ticket activity present');
	assert(!titles.includes('SECRET build'), 'private ticket activity dropped');
	assert(titles.includes('Public idea'), 'public suggestion activity present');
	assert(!titles.includes('HIDDEN idea'), 'hidden suggestion activity dropped');
	assert(titles.includes('v1.0.0'), 'published release activity present');
	assert(!titles.includes('v9.9.9-draft'), 'draft release activity dropped');
	assert(!act.some((a) => a.type === 'ticket.moved'), 'off-whitelist type dropped');
	assert(act.every((a) => 'actorAvatar' in a), 'actor avatar field present');
	const actPrivate = await listPublicActivity(project.id, false);
	assert(!actPrivate.some((a) => a.ticketTitle), 'isPublic=false → no ticket activity');
	assert(actPrivate.some((a) => a.suggestionTitle === 'Public idea'), 'members still see public suggestion activity');

	console.log('[5] listPublicMilestones');
	const miles = await listPublicMilestones(project.id, true);
	assert(miles.length === 1 && miles[0].title === 'v1', 'open milestone listed');
	assert(miles[0].openCount === 1 && miles[0].closedCount === 1, `public-only milestone counts (got ${miles[0].openCount}/${miles[0].closedCount})`);
	assert((await listPublicMilestones(project.id, false)).length === 0, 'isPublic=false → empty');

	console.log('[6] listTopIdeas');
	const ideas = await listTopIdeas(project.id, { includeHidden: false, voter: { userId: user.id } });
	assert(ideas.some((i) => i.title === 'Public idea'), 'public idea listed');
	assert(!ideas.some((i) => i.title === 'HIDDEN idea'), 'hidden idea excluded for public');
	assert(ideas.find((i) => i.title === 'Public idea')!.voted === true, 'voted flag merged');
	assert(ideas.every((i) => 'authorAvatar' in i), 'author avatar on cards');
	const memberIdeas = await listTopIdeas(project.id, { includeHidden: true });
	assert(memberIdeas.some((i) => i.title === 'HIDDEN idea'), 'members see hidden ideas');

	console.log('[7] converted-ticket summary + releaseForTicket');
	const sum = await getConvertedTicketSummary(tShip.id);
	assert(sum !== null && sum.columnCategory === 'done' && sum.closedAt != null, 'summary resolves column + closedAt');
	const relFor = await releaseForTicket(tShip.id);
	assert(relFor?.version === 'v1.0.0', 'releaseForTicket finds the published release');
	assert((await releaseForTicket(tOpen.id)) === null, 'no release → null');

	// cleanup
	await db.delete(schema.activity).where(eq(schema.activity.projectId, project.id));
	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	await db.delete(schema.users).where(eq(schema.users.id, user.id));

	console.log('\n✅ smoke-public passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-public failed:', err);
	await closeDb();
	process.exit(1);
});
