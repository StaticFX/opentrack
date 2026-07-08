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
	/** Directory for uploaded attachment bytes (under the persistent data volume). */
	get uploadsDir() {
		return str('UPLOADS_DIR', './data/uploads');
	},
	get pubsubDriver(): PubsubDriver {
		return str('PUBSUB_DRIVER', 'memory') === 'postgres' ? 'postgres' : 'memory';
	},
	// OAuth login providers and the GitHub App are configured in the admin UI and
	// stored (encrypted) in the DB — see `$lib/server/config` + `auth/oauth`. They
	// are intentionally NOT read from the environment.
	bootstrapAdmin: {
		get username() {
			return opt('ADMIN_USERNAME');
		},
		get email() {
			return opt('ADMIN_EMAIL');
		},
		get password() {
			return opt('ADMIN_PASSWORD');
		}
	}
};
