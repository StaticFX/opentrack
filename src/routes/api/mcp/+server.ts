import { error } from '@sveltejs/kit';
import { getConfig } from '$lib/server/config';
import { resolveMcpContext } from '$lib/server/mcp/context';
import { handleMcpMessage } from '$lib/server/mcp/server';
import { rateLimit } from '$lib/server/util/ratelimit';
import type { RequestHandler } from './$types';

const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'POST, OPTIONS',
	'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version'
};

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', ...CORS }
	});
}

export const OPTIONS: RequestHandler = async () => new Response(null, { status: 204, headers: CORS });

// Streamable HTTP transport is POST-only here (no server-initiated SSE stream).
export const GET: RequestHandler = async () =>
	new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST', ...CORS } });

export const POST: RequestHandler = async ({ request }) => {
	if (!(await getConfig()).mcp.enabled) throw error(404, 'MCP is not enabled on this instance');

	const ctx = await resolveMcpContext(request);
	if (!ctx) {
		return jsonResponse(
			{ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Invalid or missing API key' } },
			401
		);
	}
	if (!rateLimit(`mcp:${ctx.workspaceId}`, 240, 60_000)) {
		return jsonResponse({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Rate limit exceeded' } }, 429);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return jsonResponse({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
	}

	const batch = Array.isArray(body);
	const messages = (batch ? body : [body]) as Array<Record<string, unknown>>;
	const responses = [];
	for (const m of messages) {
		const r = await handleMcpMessage(m, ctx);
		if (r) responses.push(r);
	}

	// All-notifications → 202 with no body, per JSON-RPC.
	if (responses.length === 0) return new Response(null, { status: 202, headers: CORS });
	return jsonResponse(batch ? responses : responses[0]);
};
