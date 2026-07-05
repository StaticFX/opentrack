import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	// Make .env values available on process.env so $lib/server/env.ts (which reads
	// process.env, to stay usable in tsx scripts) works during `vite dev`/`build`.
	Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
	return {
		plugins: [tailwindcss(), sveltekit()]
	};
});
