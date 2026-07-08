// Verify the MCP layer end to end: API-key auth → actor resolution → the JSON-RPC
// handshake (initialize / tools.list / tools.call) across read + write tools.
process.env.ORIGIN = 'https://track.example.com';
import '$lib/server/load-env';
import { and, eq } from 'drizzle-orm';
import type { SessionUser } from '$lib/server/auth/session';
import { closeDb, db, schema } from '$lib/server/db';
import { createApiKey } from '$lib/server/services/api-keys';
import { createProject } from '$lib/server/services/projects';
import { createWorkspace } from '$lib/server/services/workspaces';
import { resolveMcpContext } from '$lib/server/mcp/context';
import { handleMcpMessage } from '$lib/server/mcp/server';

function assert(c: unknown, m: string) {
	if (!c) throw new Error('FAIL: ' + m);
	console.log('  ✓ ' + m);
}
const req = (raw: string) => new Request('http://x/api/mcp', { headers: { authorization: `Bearer ${raw}` } });

// Unwrap a tools/call result's text payload back into an object.
function callResult(resp: any) {
	assert(!resp.error, 'no JSON-RPC error');
	const text = resp.result?.content?.[0]?.text ?? '';
	assert(!resp.result?.isError, `tool did not error: ${text}`);
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}
let idc = 0;
async function call(ctx: any, name: string, args: object) {
	return handleMcpMessage({ jsonrpc: '2.0', id: ++idc, method: 'tools/call', params: { name, arguments: args } }, ctx) as any;
}

async function main() {
	// Seed a workspace + project + admin + API key.
	const [u] = await db.insert(schema.users).values({ username: `mcp-${Date.now()}`, displayName: 'MCP', isAdmin: true }).returning();
	const user: SessionUser = { id: u.id, username: u.username, displayName: u.displayName, email: null, avatarUrl: null, isAdmin: true };
	const ws = await createWorkspace(user, { name: 'MCP WS' });
	const project = await createProject(user, { ...ws }, { name: 'MCP Proj' });
	const { raw } = await createApiKey(ws.id, 'mcp-key', user.id);

	console.log('[1] auth: API key → workspace + actor');
	assert((await resolveMcpContext(req('otk_bogus'))) === null, 'invalid key rejected');
	const ctx = await resolveMcpContext(req(raw));
	assert(ctx?.workspaceId === ws.id && ctx?.actor?.id === u.id, 'valid key resolves workspace + actor');

	console.log('[2] initialize + tools/list');
	const init = (await handleMcpMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, ctx!)) as any;
	assert(init.result?.capabilities?.tools && init.result?.serverInfo?.name === 'opentrack', 'initialize advertises tools capability');
	assert(init.result?.protocolVersion === '2025-06-18', 'echoes the client protocol version');
	assert((await handleMcpMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctx!)) === null, 'notification gets no reply');
	const list = (await handleMcpMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, ctx!)) as any;
	const names = list.result.tools.map((t: any) => t.name);
	assert(['list_projects', 'list_tickets', 'get_ticket', 'search_tickets', 'create_ticket', 'update_ticket', 'add_comment'].every((n) => names.includes(n)), 'all 7 tools listed');

	console.log('[3] list_projects');
	const projects = callResult(await call(ctx, 'list_projects', {}));
	assert(projects.projects.some((p: any) => p.slug === project.slug), 'created project is listed');

	console.log('[4] create_ticket (fires app automations)');
	const created = callResult(await call(ctx, 'create_ticket', { project: project.slug, title: 'From MCP', description: 'hi', priority: 'high' }));
	assert(typeof created.number === 'number' && created.url.includes(`/t/${created.number}`), 'ticket created, returns number + url');

	console.log('[5] get_ticket + list_tickets + search');
	const detail = callResult(await call(ctx, 'get_ticket', { project: project.slug, number: created.number }));
	assert(detail.title === 'From MCP' && detail.priority === 'high' && detail.status === 'open', 'get_ticket returns detail');
	const tickets = callResult(await call(ctx, 'list_tickets', { project: project.slug, status: 'open' }));
	assert(tickets.tickets.some((t: any) => t.number === created.number), 'list_tickets includes it');
	const found = callResult(await call(ctx, 'search_tickets', { query: 'from mcp' }));
	assert(found.results.some((r: any) => r.number === created.number), 'search_tickets finds it (case-insensitive)');

	console.log('[6] update_ticket + add_comment');
	callResult(await call(ctx, 'update_ticket', { project: project.slug, number: created.number, priority: 'urgent' }));
	const after = callResult(await call(ctx, 'get_ticket', { project: project.slug, number: created.number }));
	assert(after.priority === 'urgent', 'update_ticket changed priority');
	callResult(await call(ctx, 'add_comment', { project: project.slug, number: created.number, body: 'a comment' }));
	const [c] = await db.select().from(schema.comments).where(eq(schema.comments.subjectId, (await db.select({ id: schema.tickets.id }).from(schema.tickets).where(and(eq(schema.tickets.projectId, project.id), eq(schema.tickets.number, created.number))).limit(1))[0].id));
	assert(c?.body === 'a comment', 'comment persisted');

	console.log('[7] error handling');
	const bad = (await call(ctx, 'get_ticket', { project: project.slug, number: 99999 })) as any;
	assert(bad.result?.isError, 'missing ticket → tool isError (not a crash)');
	const unknown = (await call(ctx, 'nope', {})) as any;
	assert(unknown.error?.code === -32602, 'unknown tool → JSON-RPC error');

	console.log('[8] fine-grained scopes (read-only key)');
	const { raw: roRaw } = await createApiKey(ws.id, 'ro-key', user.id, ['read']);
	const ro = await resolveMcpContext(req(roRaw));
	assert(ro?.scopes.length === 1 && ro.scopes[0] === 'read', 'read-only key resolves scope [read]');
	const roList = (await handleMcpMessage({ jsonrpc: '2.0', id: 90, method: 'tools/list' }, ro!)) as any;
	const roNames = roList.result.tools.map((t: any) => t.name);
	assert(roNames.includes('list_tickets') && !roNames.includes('create_ticket'), 'tools/list hides write tools for a read-only key');
	const denied = (await call(ro, 'create_ticket', { project: project.slug, title: 'nope' })) as any;
	assert(denied.result?.isError && /write/.test(denied.result.content[0].text), 'write tool call rejected for read-only key');
	const stillReads = callResult(await call(ro, 'list_projects', {}));
	assert(Array.isArray(stillReads.projects), 'read tool still works for read-only key');

	console.log('\n✅ smoke-mcp passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-mcp failed:', err);
	await closeDb();
	process.exit(1);
});
