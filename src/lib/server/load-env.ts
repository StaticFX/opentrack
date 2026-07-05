// Side-effect module for standalone tsx scripts (migrate/seed/worker): load
// `.env` into process.env before any db/env module runs. Import this FIRST.
// In the SvelteKit runtime this module is not used (vite.config loads .env).
try {
	// Node 20.12+/22: loads ./.env into process.env.
	process.loadEnvFile();
} catch {
	// No .env file — rely on real environment variables.
}
