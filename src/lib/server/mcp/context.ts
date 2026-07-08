import type { ApiScope } from '$lib/apiScopes';
import type { SessionUser } from '$lib/server/auth/session';
import { getUserById } from '$lib/server/auth/user';
import { verifyApiKeyFull } from '$lib/server/services/api-keys';

/** Everything a tool needs: the key's workspace + the actor writes belong to. */
export interface McpContext {
	workspaceId: string;
	/** The API key's creator, used to attribute mutations. Null if that account was removed. */
	actor: SessionUser | null;
	/** The key's scopes — gates which tools are available. */
	scopes: ApiScope[];
}

function bearer(request: Request): string {
	const auth = request.headers.get('authorization');
	return auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
}

/** Resolve the MCP request's API key → workspace + actor, or null if invalid. */
export async function resolveMcpContext(request: Request): Promise<McpContext | null> {
	const key = await verifyApiKeyFull(bearer(request));
	if (!key) return null;

	let actor: SessionUser | null = null;
	if (key.actorId) {
		const u = await getUserById(key.actorId);
		if (u) {
			actor = {
				id: u.id,
				username: u.username,
				displayName: u.displayName,
				email: u.email,
				avatarUrl: u.avatarUrl,
				isAdmin: u.isAdmin
			};
		}
	}
	return { workspaceId: key.workspaceId, actor, scopes: key.scopes };
}
