<script lang="ts">
	import { page } from '$app/state';
	import '../app.css';

	const status = $derived(page.status);
	const message = $derived(page.error?.message ?? 'Something went wrong');
</script>

<svelte:head><title>{status} · OpenTrack</title></svelte:head>

<main class="grid min-h-screen place-items-center px-6 text-center">
	<div>
		<p class="text-6xl font-bold tracking-tight text-neutral-300 dark:text-neutral-700">{status}</p>
		<p class="mt-3 text-lg font-medium">{message}</p>
		<a href="/" class="mt-6 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
			Back home
		</a>
	</div>
</main>
