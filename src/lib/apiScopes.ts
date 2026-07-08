// Client-safe API-token scopes shared by the admin + workspace UIs and the
// server enforcement. Two coarse scopes today: read and write.

export const API_SCOPES = ['read', 'write'] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const API_SCOPE_META: Record<ApiScope, { label: string; desc: string }> = {
	read: { label: 'Read', desc: 'List & read tickets, projects, and search (v1 endpoints + MCP read tools).' },
	write: { label: 'Write', desc: 'Create/update tickets and add comments (MCP write tools).' }
};

/** Coerce arbitrary input to a valid, de-duped scope list (order: read, write). */
export function normalizeScopes(input: unknown): ApiScope[] {
	const arr = (Array.isArray(input) ? input : []).map(String);
	return API_SCOPES.filter((s) => arr.includes(s));
}

/**
 * The effective scopes of a stored key. Legacy keys (created before scopes
 * existed, `null`) are treated as full access so they keep working.
 */
export function effectiveScopes(stored: string[] | null | undefined): ApiScope[] {
	if (stored == null) return ['read', 'write'];
	return normalizeScopes(stored);
}
