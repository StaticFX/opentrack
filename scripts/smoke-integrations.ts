import '$lib/server/load-env';
import { and, eq } from 'drizzle-orm';
import { closeDb, db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { DEFAULT_NOTIFICATION_EVENTS } from '$lib/integrations/events';
import {
	deleteIntegration,
	getIntegration,
	listIntegrations,
	upsertIntegration
} from '$lib/server/integrations/store';
import { notifyIntegrations } from '$lib/server/integrations/notify';
import {
	getIssueTracker,
	getNotificationProvider,
	issueTrackerCatalogKeys,
	linkedIssueTracker,
	notificationCatalogKeys
} from '$lib/server/integrations/registry';
import { buildGitlabIssue, createGitlabIssue } from '$lib/server/integrations/providers/gitlab';
import type { FetchLike } from '$lib/server/integrations/types';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { createProject } from '$lib/server/services/projects';
import { createTicket } from '$lib/server/services/tickets';
import { createWorkspace } from '$lib/server/services/workspaces';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}

const DISCORD_HOOK = 'https://discord.com/api/webhooks/123456789/abcdefTOKEN';
const SLACK_HOOK = 'https://hooks.slack.com/services/T000/B000/xyzSECRET';

async function main() {
	const [u] = await db
		.insert(schema.users)
		.values({ username: `intg-${Date.now()}`, displayName: 'Integ Tester' })
		.returning();
	const user: SessionUser = { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: false };

	const ws = await createWorkspace(user, { name: 'Integ WS' });
	const project = await createProject(user, { ...ws }, { name: 'Integ Proj' });
	const [board] = await listBoards(project.id);
	const todo = (await getBoardColumns(board.id)).find((c) => c.category === 'todo')!;
	const ticket = await createTicket(user, { projectId: project.id, boardId: board.id, columnId: todo.id, title: 'Server crash' });

	console.log('[1] generic store: encrypted secrets roundtrip, config persistence');
	assert((await getIntegration(project.id, 'discord')) === null, 'no row before setup');
	await upsertIntegration(project.id, 'discord', {
		config: { events: ['ticket.created', 'release.published'] },
		secrets: { webhookUrl: DISCORD_HOOK }
	});
	const [rawRow] = await db
		.select({ secrets: schema.projectIntegrations.secrets })
		.from(schema.projectIntegrations)
		.where(and(eq(schema.projectIntegrations.projectId, project.id), eq(schema.projectIntegrations.key, 'discord')));
	assert(!!rawRow.secrets && !rawRow.secrets.includes('abcdefTOKEN'), 'secret stored encrypted (not plaintext)');
	const st = await getIntegration<{ events: string[] }, { webhookUrl: string }>(project.id, 'discord');
	assert(st?.secrets.webhookUrl === DISCORD_HOOK, 'getIntegration decrypts the secret');
	assert(st?.enabled === true, 'defaults to enabled');
	assert(JSON.stringify(st?.config.events) === JSON.stringify(['ticket.created', 'release.published']), 'config persisted');

	console.log('[2] listIntegrations never leaks secrets');
	const listed = await listIntegrations(project.id);
	assert(listed.length === 1 && listed[0].key === 'discord', 'lists the installed integration');
	assert(!JSON.stringify(listed).includes('webhookUrl') && !JSON.stringify(listed).includes('slack.com'), 'no secret material in the list view');

	console.log('[3] registry: notification providers present + payload shapes differ');
	assert(notificationCatalogKeys().join(',') === 'discord,slack', 'catalog order = discord,slack');
	const discord = getNotificationProvider('discord')!;
	const slack = getNotificationProvider('slack')!;
	const ctx = { event: 'ticket.created', title: '#7 Server crash', url: `/${ws.slug}/${project.slug}/t/7`, description: 'boom', actor: 'Integ Tester', fields: [{ name: 'Column', value: 'Todo' }], origin: 'https://track.example.com' };
	const dPayload = discord.buildPayload(ctx) as { embeds: Array<{ title: string; url: string }> };
	assert(dPayload.embeds[0].title === '#7 Server crash', 'discord embed built');
	assert(dPayload.embeds[0].url === `https://track.example.com/${ws.slug}/${project.slug}/t/7`, 'discord absolutizes relative url');
	const sPayload = slack.buildPayload(ctx) as { attachments: Array<{ title: string; title_link: string; fields: Array<{ title: string; value: string }> }> };
	assert(sPayload.attachments[0].title === '#7 Server crash', 'slack attachment built');
	assert(sPayload.attachments[0].title_link === `https://track.example.com/${ws.slug}/${project.slug}/t/7`, 'slack absolutizes relative url');
	assert(sPayload.attachments[0].fields.some((x) => x.title === 'By' && x.value === 'Integ Tester'), 'slack appends actor field');

	console.log('[4] webhook validation per provider');
	assert(discord.validateWebhook(DISCORD_HOOK) === null, 'discord accepts a discord hook');
	assert(discord.validateWebhook(SLACK_HOOK) !== null, 'discord rejects a slack hook');
	assert(slack.validateWebhook(SLACK_HOOK) === null, 'slack accepts a slack hook');
	assert(slack.validateWebhook(DISCORD_HOOK) !== null, 'slack rejects a discord hook');

	console.log('[5] notifyIntegrations fans out to every enabled provider + gates by event');
	// Add Slack too, listening on all events; disable an event on Discord.
	await upsertIntegration(project.id, 'slack', { secrets: { webhookUrl: SLACK_HOOK } });
	const q = () => db.select().from(schema.jobs).where(eq(schema.jobs.queue, 'integration:notify'));
	await db.delete(schema.jobs).where(eq(schema.jobs.queue, 'integration:notify'));

	await notifyIntegrations(project.id, 'ticket.created', 'ticket', ticket.id, { actor: 'Integ Tester' });
	let jobs = await q();
	assert(jobs.length === 2, 'ticket.created (both listening) → 2 jobs');
	assert(new Set(jobs.map((j) => (j.payload as { key: string }).key)).size === 2, 'one job per provider (discord + slack)');
	const dj = jobs.find((j) => (j.payload as { key: string }).key === 'discord')!;
	assert((dj.payload as { data: { url: string } }).data.url === `/${ws.slug}/${project.slug}/t/${ticket.number}`, 'job carries resolved deep link');

	await db.delete(schema.jobs).where(eq(schema.jobs.queue, 'integration:notify'));
	await notifyIntegrations(project.id, 'suggestion.created', 'suggestion', 'nope', {});
	jobs = await q();
	// Discord does NOT list suggestion.created (config subset); Slack does (default all).
	assert(jobs.length === 1 && (jobs[0].payload as { key: string }).key === 'slack', 'event gated per-provider by config (only slack fires)');

	console.log('[6] disabled integration is skipped by the fan-out');
	// suggestion.resolved: only Slack (default all) listens; Discord's config
	// subset excludes it. Disabling Slack should leave zero interested providers.
	await upsertIntegration(project.id, 'slack', { enabled: false });
	await db.delete(schema.jobs).where(eq(schema.jobs.queue, 'integration:notify'));
	await notifyIntegrations(project.id, 'suggestion.resolved', 'ticket', ticket.id, {});
	assert((await q()).length === 0, 'no jobs when the only listening provider is disabled');

	console.log('[7] post() via injected fetch: ok + dead-endpoint status');
	let sentTo = '';
	const okFetch: FetchLike = (async (url: string) => { sentTo = String(url); return { ok: true, status: 200 } as Response; }) as unknown as FetchLike;
	const r = await slack.post(SLACK_HOOK, { text: 'hi' }, okFetch);
	assert(r.ok && sentTo === SLACK_HOOK, 'slack posts to the webhook URL');
	const badFetch: FetchLike = (async () => ({ ok: false, status: 404 }) as Response) as unknown as FetchLike;
	assert((await discord.post(DISCORD_HOOK, {}, badFetch)).status === 404, '404 surfaced (handler disables dead hooks)');

	console.log('[8] issue-tracker registry: github + gitlab, link detection');
	assert(issueTrackerCatalogKeys().join(',') === 'github,gitlab', 'catalog order = github,gitlab');
	assert((await linkedIssueTracker(project.id)) === null, 'no tracker linked yet');
	const gitlab = getIssueTracker('gitlab')!;
	assert(!(await gitlab.isLinked(project.id)), 'gitlab not linked before config');
	await upsertIntegration(project.id, 'gitlab', { config: { projectPath: 'grp/repo' }, secrets: { token: 'glpat-xxx' } });
	assert(await gitlab.isLinked(project.id), 'gitlab linked once path + token stored');
	assert((await linkedIssueTracker(project.id))?.key === 'gitlab', 'linkedIssueTracker resolves gitlab');

	console.log('[9] gitlab payload mapping + create via injected fetch');
	const openPayload = buildGitlabIssue({ title: 'A', description: 'body' }, false);
	assert(openPayload.state_event === 'reopen' && openPayload.title === 'A', 'open ticket → reopen');
	assert(buildGitlabIssue({ title: 'A', description: null }, true).state_event === 'close', 'closed ticket → close');
	let glReq: { url: string; token: string } | null = null;
	const glFetch: FetchLike = (async (url: string, init: RequestInit) => {
		glReq = { url: String(url), token: String((init.headers as Record<string, string>)['PRIVATE-TOKEN']) };
		return { ok: true, status: 201, json: async () => ({ iid: 42 }) } as unknown as Response;
	}) as unknown as FetchLike;
	const created = await createGitlabIssue({ projectPath: 'grp/repo' }, 'glpat-xxx', openPayload, glFetch);
	assert(created.iid === 42, 'createGitlabIssue returns the new iid');
	assert(glReq!.url === 'https://gitlab.com/api/v4/projects/grp%2Frepo/issues', 'posts to url-encoded project path');
	assert(glReq!.token === 'glpat-xxx', 'sends the PRIVATE-TOKEN header');
	await deleteIntegration(project.id, 'gitlab');

	console.log('[10] cascade delete: removing the project removes its integration rows');
	await deleteIntegration(project.id, 'slack');
	assert((await listIntegrations(project.id)).length === 1, 'deleteIntegration removes one row');
	await db.delete(schema.jobs).where(eq(schema.jobs.queue, 'integration:notify'));
	await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
	assert((await db.select().from(schema.projectIntegrations).where(eq(schema.projectIntegrations.projectId, project.id))).length === 0, 'rows gone after project/workspace delete (FK cascade)');
	await db.delete(schema.users).where(eq(schema.users.id, user.id));

	console.log('\n✅ smoke-integrations passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-integrations failed:', err);
	await closeDb();
	process.exit(1);
});
