import { and, eq } from 'drizzle-orm';
import { decryptSecret, encryptSecret } from '$lib/server/crypto';
import { db, schema } from '$lib/server/db';

/**
 * Generic per-project integration state, backed by `project_integrations`.
 * `config` is stored as plain JSON (non-secret settings); `secrets` is an
 * AES-256-GCM-encrypted JSON blob. Every pluggable provider (Discord, Slack,
 * GitLab, …) persists through this instead of adding bespoke `projects.*`
 * columns, which is what makes adding a provider a code-only change.
 */
export interface IntegrationState<
	C extends Record<string, unknown> = Record<string, unknown>,
	S extends Record<string, unknown> = Record<string, unknown>
> {
	enabled: boolean;
	config: C;
	secrets: S;
}

function decodeSecrets(blob: string | null): Record<string, unknown> {
	if (!blob) return {};
	try {
		return JSON.parse(decryptSecret(blob)) as Record<string, unknown>;
	} catch {
		return {}; // corrupt or rotated key — treat as unset
	}
}

/** Read a project's integration state, or null when the row doesn't exist. */
export async function getIntegration<
	C extends Record<string, unknown> = Record<string, unknown>,
	S extends Record<string, unknown> = Record<string, unknown>
>(projectId: string, key: string): Promise<IntegrationState<C, S> | null> {
	const [row] = await db
		.select({
			enabled: schema.projectIntegrations.enabled,
			config: schema.projectIntegrations.config,
			secrets: schema.projectIntegrations.secrets
		})
		.from(schema.projectIntegrations)
		.where(
			and(
				eq(schema.projectIntegrations.projectId, projectId),
				eq(schema.projectIntegrations.key, key)
			)
		)
		.limit(1);
	if (!row) return null;
	return {
		enabled: row.enabled,
		config: ((row.config as C | null) ?? ({} as C)),
		secrets: decodeSecrets(row.secrets) as S
	};
}

/**
 * Create or update a project's integration row. Any field left `undefined` is
 * preserved. `secrets` is fully replaced (not merged) when provided, so pass
 * the complete secret object.
 */
export async function upsertIntegration(
	projectId: string,
	key: string,
	patch: {
		enabled?: boolean;
		config?: Record<string, unknown>;
		secrets?: Record<string, unknown>;
	}
): Promise<void> {
	const now = new Date();
	const set: Record<string, unknown> = { updatedAt: now };
	if (patch.enabled !== undefined) set.enabled = patch.enabled;
	if (patch.config !== undefined) set.config = patch.config;
	if (patch.secrets !== undefined) {
		const hasSecret = Object.keys(patch.secrets).length > 0;
		set.secrets = hasSecret ? encryptSecret(JSON.stringify(patch.secrets)) : null;
	}
	await db
		.insert(schema.projectIntegrations)
		.values({
			projectId,
			key,
			enabled: patch.enabled ?? true,
			config: patch.config ?? null,
			secrets:
				patch.secrets && Object.keys(patch.secrets).length
					? encryptSecret(JSON.stringify(patch.secrets))
					: null,
			createdAt: now,
			updatedAt: now
		})
		.onConflictDoUpdate({
			target: [schema.projectIntegrations.projectId, schema.projectIntegrations.key],
			set
		});
}

/** Remove a project's integration row entirely. */
export async function deleteIntegration(projectId: string, key: string): Promise<void> {
	await db
		.delete(schema.projectIntegrations)
		.where(
			and(
				eq(schema.projectIntegrations.projectId, projectId),
				eq(schema.projectIntegrations.key, key)
			)
		);
}

/** List a project's integration rows (config only — never returns secrets). */
export async function listIntegrations(
	projectId: string
): Promise<Array<{ key: string; enabled: boolean; config: Record<string, unknown> }>> {
	const rows = await db
		.select({
			key: schema.projectIntegrations.key,
			enabled: schema.projectIntegrations.enabled,
			config: schema.projectIntegrations.config
		})
		.from(schema.projectIntegrations)
		.where(eq(schema.projectIntegrations.projectId, projectId));
	return rows.map((r) => ({
		key: r.key,
		enabled: r.enabled,
		config: (r.config as Record<string, unknown> | null) ?? {}
	}));
}
