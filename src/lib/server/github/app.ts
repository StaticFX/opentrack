import { App } from '@octokit/app';
import { getConfig } from '$lib/server/config';

let cached: { app: App; sig: string } | null = null;

/** Whether the GitHub App is configured (via admin settings or env). */
export async function githubConfigured(): Promise<boolean> {
	const g = (await getConfig()).githubApp;
	return !!(g.appId && g.privateKey && g.webhookSecret);
}

export async function getApp(): Promise<App> {
	const g = (await getConfig()).githubApp;
	if (!g.appId || !g.privateKey || !g.webhookSecret) throw new Error('GitHub App is not configured');

	const sig = `${g.appId}:${g.webhookSecret.length}:${g.privateKey.length}`;
	if (cached && cached.sig === sig) return cached.app;

	const app = new App({
		appId: g.appId,
		privateKey: g.privateKey,
		webhooks: { secret: g.webhookSecret },
		oauth:
			g.clientId && g.clientSecret
				? { clientId: g.clientId, clientSecret: g.clientSecret }
				: { clientId: 'unused', clientSecret: 'unused' }
	});
	cached = { app, sig };
	return app;
}

/** An Octokit authenticated as a specific installation. */
export async function installationOctokit(installationId: string) {
	return (await getApp()).getInstallationOctokit(Number(installationId));
}

/** URL that starts the GitHub App installation flow, carrying signed state. */
export async function installUrl(state: string): Promise<string> {
	const slug = (await getConfig()).githubApp.slug ?? 'opentrack';
	return `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(state)}`;
}
