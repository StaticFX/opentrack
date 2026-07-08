import type { McpContext } from './context';
import { MCP_TOOLS } from './tools';

// Minimal, stateless MCP over JSON-RPC 2.0 (Streamable HTTP). We implement the
// tools capability only: initialize → tools/list → tools/call. Server-initiated
// messages aren't used, so a single JSON response per request is sufficient.

const SERVER_INFO = { name: 'opentrack', version: '1.0.0' };
const DEFAULT_PROTOCOL = '2024-11-05';

interface JsonRpcMessage {
	jsonrpc?: string;
	id?: string | number | null;
	method?: string;
	params?: Record<string, unknown>;
}

function ok(id: unknown, result: unknown) {
	return { jsonrpc: '2.0', id, result };
}
function fail(id: unknown, code: number, message: string) {
	return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

/**
 * Handle one JSON-RPC message. Returns the response object, or null for
 * notifications (no `id`) that don't warrant a reply.
 */
export async function handleMcpMessage(
	msg: JsonRpcMessage,
	ctx: McpContext
): Promise<object | null> {
	const { id, method, params } = msg;
	const isNotification = id === undefined || id === null;

	switch (method) {
		case 'initialize':
			return ok(id, {
				protocolVersion: typeof params?.protocolVersion === 'string' ? params.protocolVersion : DEFAULT_PROTOCOL,
				capabilities: { tools: {} },
				serverInfo: SERVER_INFO
			});

		case 'notifications/initialized':
		case 'notifications/cancelled':
			return null;

		case 'ping':
			return ok(id, {});

		case 'tools/list':
			// Only advertise tools the key's scopes permit.
			return ok(id, {
				tools: MCP_TOOLS.filter((t) => ctx.scopes.includes(t.scope)).map((t) => ({
					name: t.name,
					description: t.description,
					inputSchema: t.inputSchema
				}))
			});

		case 'tools/call': {
			const name = String(params?.name ?? '');
			const tool = MCP_TOOLS.find((t) => t.name === name);
			if (!tool) return fail(id, -32602, `Unknown tool: ${name}`);
			if (!ctx.scopes.includes(tool.scope)) {
				return ok(id, {
					content: [{ type: 'text', text: `This API key lacks the "${tool.scope}" scope required for ${name}.` }],
					isError: true
				});
			}
			const args = (params?.arguments as Record<string, unknown>) ?? {};
			try {
				const result = await tool.handler(ctx, args);
				const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
				// Tool-level failures are reported via isError so the model sees them.
				return ok(id, { content: [{ type: 'text', text }] });
			} catch (e) {
				const text = e instanceof Error ? e.message : String(e);
				return ok(id, { content: [{ type: 'text', text }], isError: true });
			}
		}

		default:
			if (isNotification) return null;
			return fail(id, -32601, `Method not found: ${method ?? '(none)'}`);
	}
}
