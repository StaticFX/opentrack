import { asc, eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { installationOctokit } from './app';

export type Installation = typeof schema.githubInstallations.$inferSelect;

/** Store (or update) an installation and link it to a workspace. */
export async function storeInstallation(input: {
	workspaceId: string;
	installationId: string;
	accountLogin: string;
	accountType?: string | null;
}): Promise<void> {
	await db
		.insert(schema.githubInstallations)
		.values({
			workspaceId: input.workspaceId,
			installationId: input.installationId,
			accountLogin: input.accountLogin,
			accountType: input.accountType ?? null
		})
		.onConflictDoUpdate({
			target: schema.githubInstallations.installationId,
			set: {
				workspaceId: input.workspaceId,
				accountLogin: input.accountLogin,
				accountType: input.accountType ?? null
			}
		});
}

export function listForWorkspace(workspaceId: string): Promise<Installation[]> {
	return db
		.select()
		.from(schema.githubInstallations)
		.where(eq(schema.githubInstallations.workspaceId, workspaceId))
		.orderBy(asc(schema.githubInstallations.accountLogin));
}

export async function getByInstallationId(installationId: string): Promise<Installation | null> {
	const [row] = await db
		.select()
		.from(schema.githubInstallations)
		.where(eq(schema.githubInstallations.installationId, installationId))
		.limit(1);
	return row ?? null;
}

export async function removeInstallation(id: string): Promise<void> {
	await db.delete(schema.githubInstallations).where(eq(schema.githubInstallations.id, id));
}

export interface RepoOption {
	id: number;
	fullName: string;
	private: boolean;
	installationId: string;
}

/** Repositories accessible to an installation (requires GitHub credentials). */
export async function listRepos(installationId: string): Promise<RepoOption[]> {
	const octokit = await installationOctokit(installationId);
	const res = await octokit.request('GET /installation/repositories', { per_page: 100 });
	return res.data.repositories.map((r: { id: number; full_name: string; private: boolean }) => ({
		id: r.id,
		fullName: r.full_name,
		private: r.private,
		installationId
	}));
}

/** All repos across every installation linked to a workspace (best-effort). */
export async function listWorkspaceRepos(workspaceId: string): Promise<RepoOption[]> {
	const installations = await listForWorkspace(workspaceId);
	const results = await Promise.allSettled(installations.map((i) => listRepos(i.installationId)));
	return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}
