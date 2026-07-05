// Central environment reader. Uses `process.env` (not SvelteKit's `$env`) so the
// same server modules work both inside the SvelteKit runtime and in standalone
// `tsx` scripts (migrate/seed/worker). In dev, `vite.config.ts` loads `.env`
// into `process.env`; scripts load it via `--env-file`.

function str(key: string, fallback = ''): string {
	return process.env[key] ?? fallback;
}

function opt(key: string): string | undefined {
	const v = process.env[key];
	return v && v.length > 0 ? v : undefined;
}

export type DatabaseDriver = 'postgres' | 'sqlite';
export type PubsubDriver = 'memory' | 'postgres';

export const env = {
	get origin() {
		return str('ORIGIN', 'http://localhost:5173');
	},
	get secret() {
		return str('SECRET', 'dev-insecure-secret');
	},
	get databaseDriver(): DatabaseDriver {
		return str('DATABASE_DRIVER', 'postgres') === 'sqlite' ? 'sqlite' : 'postgres';
	},
	get databaseUrl() {
		return str('DATABASE_URL');
	},
	get sqliteUrl() {
		return str('SQLITE_URL', 'file:./data/opentrack.db');
	},
	get sqliteAuthToken() {
		return opt('SQLITE_AUTH_TOKEN');
	},
	get pubsubDriver(): PubsubDriver {
		return str('PUBSUB_DRIVER', 'memory') === 'postgres' ? 'postgres' : 'memory';
	},
	oauth: {
		get github() {
			return provider('GITHUB');
		},
		get discord() {
			return provider('DISCORD');
		},
		get modrinth() {
			return provider('MODRINTH');
		}
	},
	githubApp: {
		get appId() {
			return opt('GITHUB_APP_ID');
		},
		get slug() {
			// The app's URL slug, used to build the installation link.
			return opt('GITHUB_APP_SLUG');
		},
		get privateKey() {
			// Support both literal newlines and \n-escaped keys.
			return opt('GITHUB_APP_PRIVATE_KEY')?.replace(/\\n/g, '\n');
		},
		get webhookSecret() {
			return opt('GITHUB_APP_WEBHOOK_SECRET');
		},
		get clientId() {
			return opt('GITHUB_APP_CLIENT_ID');
		},
		get clientSecret() {
			return opt('GITHUB_APP_CLIENT_SECRET');
		}
	},
	bootstrapAdmin: {
		get email() {
			return opt('ADMIN_EMAIL');
		},
		get password() {
			return opt('ADMIN_PASSWORD');
		}
	}
};

function provider(prefix: string): { clientId: string; clientSecret: string } | null {
	const clientId = opt(`${prefix}_CLIENT_ID`);
	const clientSecret = opt(`${prefix}_CLIENT_SECRET`);
	if (!clientId || !clientSecret) return null;
	return { clientId, clientSecret };
}
