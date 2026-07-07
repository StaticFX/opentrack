import { installationOctokit } from './app';
import type { OctokitLike } from './import';

/**
 * Resolve the Octokit client to use for an OUTBOUND write, given the acting
 * user. When we can authenticate as the user who triggered the change (they
 * have a linked GitHub account with a stored, write-scoped token), the issue /
 * comment is attributed to *them* on GitHub. Otherwise we fall back to the App
 * installation (the bot identity), which is today's behavior.
 *
 * The `actorUserId` is threaded end-to-end (endpoint → enqueue → job → sync) so
 * that turning attribution on later is a change to `userOctokit()` alone.
 */
export async function outboundOctokit(
	installationId: string,
	actorUserId?: string | null
): Promise<OctokitLike> {
	if (actorUserId) {
		const asUser = await userOctokit(actorUserId);
		if (asUser) return asUser;
	}
	return installationOctokit(installationId);
}

/**
 * Return an Octokit authenticated AS the given OpenTrack user, or null when we
 * can't act on their behalf.
 *
 * DEFERRED: this always returns null today. Enabling it requires persisting each
 * user's GitHub OAuth access token (encrypted) with a write scope / the App's
 * user-to-server permissions, plus refresh handling for GitHub App user tokens.
 * The plumbing that carries `actorUserId` here is already in place, so this is
 * the single seam to implement when we ship per-user attribution.
 */
export async function userOctokit(_userId: string): Promise<OctokitLike | null> {
	return null;
}
