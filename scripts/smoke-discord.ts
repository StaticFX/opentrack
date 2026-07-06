import '$lib/server/load-env';
import { eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { DEFAULT_DISCORD_EVENTS } from '$lib/discord';
import {
	discordEnabledFor,
	getProjectDiscord,
	setProjectDiscord
} from '$lib/server/discord/config';
import { enqueueDiscordForSubject } from '$lib/server/discord/enqueue';
import { buildDiscordPayload, postDiscord, type FetchLike } from '$lib/server/discord/send';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { createProject } from '$lib/server/services/projects';
import { createTicket } from '$lib/server/services/tickets';
import { createWorkspace } from '$lib/server/services/workspaces';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}

const WEBHOOK = 'https://discord.com/api/webhooks/123456789/abcdefTOKEN';

async function main() {
	const [u] = await db
		.insert(schema.users)
		.values({ username: `disco-${Date.now()}`, displayName: 'Disco Fan' })
		.returning();
	const user: SessionUser = { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };

	const ws = await createWorkspace(user, { name: 'Disco WS' });
	const project = await createProject(user, { ...ws }, { name: 'Disco Proj' });
	const [board] = await listBoards(project.id);
	const todo = (await getBoardColumns(board.id)).find((c) => c.category === 'todo')!;
	const ticket = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: todo.id, title: 'Server crash' });

	console.log('[1] unconfigured project → disabled, encrypted at rest, decrypts back');
	assert(!(await discordEnabledFor(project.id, 'ticket.created')), 'disabled before setup');
	const before = await getProjectDiscord(project.id);
	assert(before.webhookUrl === null, 'no webhook before setup');
	assert(JSON.stringify(before.events) === JSON.stringify(DEFAULT_DISCORD_EVENTS), 'defaults to all events');

	await setProjectDiscord(project.id, { webhookUrl: WEBHOOK, events: ['ticket.created', 'release.published'] });
	const [raw] = await db.select({ url: schema.projects.discordWebhookUrl }).from(schema.projects).where(eq(schema.projects.id, project.id));
	assert(!!raw.url && raw.url !== WEBHOOK && !raw.url.includes('abcdefTOKEN'), 'webhook URL stored encrypted (not plaintext)');
	const cfg = await getProjectDiscord(project.id);
	assert(cfg.webhookUrl === WEBHOOK, 'getProjectDiscord decrypts the URL');
	assert(cfg.events.length === 2, 'stored the selected event subset');

	console.log('[2] per-event + per-config gating');
	assert(await discordEnabledFor(project.id, 'ticket.created'), 'enabled event passes');
	assert(!(await discordEnabledFor(project.id, 'suggestion.created')), 'unselected event is gated off');

	console.log('[3] payload builder: embed shape, colors, link prefixing, fields');
	const payload = buildDiscordPayload(
		'ticket.created',
		{ title: '#7 Server crash', url: `/${ws.slug}/${project.slug}/t/7`, description: 'boom', actor: 'Disco Fan', fields: [{ name: 'Column', value: 'Todo' }] },
		'https://track.example.com'
	) as { embeds: Array<Record<string, unknown>> };
	const embed = payload.embeds[0];
	assert(embed.title === '#7 Server crash', 'embed title = subject');
	assert(embed.url === 'https://track.example.com/' + `${ws.slug}/${project.slug}/t/7`, 'relative url prefixed with origin');
	assert(typeof embed.color === 'number', 'embed has a color');
	const fields = embed.fields as Array<{ name: string; value: string }>;
	assert(fields.some((x) => x.name === 'Column' && x.value === 'Todo'), 'custom field preserved');
	assert(fields.some((x) => x.name === 'By' && x.value === 'Disco Fan'), 'actor appended as a field');
	// Absolute URLs are passed through unchanged.
	const abs = buildDiscordPayload('release.published', { title: 'v1.0', url: 'https://x.io/y' }, 'https://track.example.com') as { embeds: Array<{ url: string }> };
	assert(abs.embeds[0].url === 'https://x.io/y', 'absolute url passed through');

	console.log('[4] enqueue gating + payload');
	const q = () => db.select().from(schema.jobs).where(eq(schema.jobs.queue, 'discord:notify'));
	const n0 = (await q()).length;
	await enqueueDiscordForSubject(project.id, 'suggestion.created', 'suggestion', 'nope', {}); // event gated off
	assert((await q()).length === n0, 'gated event does not enqueue');
	await enqueueDiscordForSubject(project.id, 'ticket.created', 'ticket', ticket.id, { actor: 'Disco Fan' });
	const jobs = await q();
	assert(jobs.length === n0 + 1, 'enabled event enqueues one job');
	const jp = jobs[jobs.length - 1].payload as { event: string; data: { title: string; url: string } };
	assert(jp.event === 'ticket.created', 'job carries the event key');
	assert(jp.data.title.includes('Server crash'), 'job data resolved subject title via subjectRef');
	assert(jp.data.url === `/${ws.slug}/${project.slug}/t/${ticket.number}`, 'job data carries deep link');

	console.log('[5] postDiscord via injected fetch: ok + failure statuses');
	let sent: { url: string; body: string } | null = null;
	const okFetch: FetchLike = (async (url: string, init: RequestInit) => {
		sent = { url: String(url), body: String(init.body) };
		return { ok: true, status: 204 } as Response;
	}) as unknown as FetchLike;
	const okRes = await postDiscord(WEBHOOK, { hello: 'world' }, okFetch);
	assert(okRes.ok && okRes.status === 204, 'ok response surfaced');
	assert(sent!.url === WEBHOOK && JSON.parse(sent!.body).hello === 'world', 'posts JSON body to the webhook URL');
	const badFetch: FetchLike = (async () => ({ ok: false, status: 404 }) as Response) as unknown as FetchLike;
	const badRes = await postDiscord(WEBHOOK, {}, badFetch);
	assert(!badRes.ok && badRes.status === 404, '404 surfaced (handler uses this to disable the hook)');

	console.log('[6] removeDiscord clears the webhook');
	await setProjectDiscord(project.id, { webhookUrl: null });
	assert((await getProjectDiscord(project.id)).webhookUrl === null, 'webhook cleared');
	assert(!(await discordEnabledFor(project.id, 'ticket.created')), 'disabled after removal');

	// cleanup
	await db.delete(schema.jobs).where(eq(schema.jobs.queue, 'discord:notify'));
	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	await db.delete(schema.users).where(eq(schema.users.id, user.id));

	console.log('\n✅ smoke-discord passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-discord failed:', err);
	await closeDb();
	process.exit(1);
});
