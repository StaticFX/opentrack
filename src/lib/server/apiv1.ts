import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { verifyApiKey } from '$lib/server/services/api-keys';
import { rateLimit } from '$lib/server/util/ratelimit';

/** Resolve + rate-limit an API key from the Authorization header or ?api_key=. */
export async function requireApiKey(request: Request, url: URL): Promise<{ workspaceId: string }> {
	const auth = request.headers.get('authorization');
	const bearer = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null;
	const raw = bearer ?? url.searchParams.get('api_key') ?? '';
	const key = await verifyApiKey(raw);
	if (!key) throw error(401, 'Invalid or missing API key');
	if (!rateLimit(`apiv1:${key.workspaceId}`, 120, 60_000)) throw error(429, 'Rate limit exceeded');
	return key;
}

/** Ensure a project exists AND belongs to the key's workspace. */
export async function apiProject(workspaceId: string, projectId: string) {
	const [p] = await db
		.select({
			id: schema.projects.id,
			slug: schema.projects.slug,
			name: schema.projects.name,
			description: schema.projects.description
		})
		.from(schema.projects)
		.where(and(eq(schema.projects.id, projectId), eq(schema.projects.workspaceId, workspaceId)))
		.limit(1);
	if (!p) throw error(404, 'Project not found');
	return p;
}

export function apiJson(data: unknown): Response {
	return new Response(JSON.stringify(data), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'access-control-allow-origin': '*',
			'cache-control': 'public, max-age=60'
		}
	});
}
