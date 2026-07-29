<script lang="ts">
	import { page } from '$app/state';
	import Button from '$lib/components/ui/Button.svelte';

	const heading = $derived(page.status === 404 ? 'Page not found' : 'Something went wrong');
</script>

<svelte:head>
	<title>{page.status} · OpenTrack</title>
</svelte:head>

<!-- Errors keep the shell: the rail and accent stay, only the panel content
     reports the failure. -->
<div class="grid min-h-full place-items-center px-6 py-16">
	<div class="max-w-md text-center">
		<p class="data-mono text-5xl! font-semibold tracking-tight text-neutral-300 dark:text-neutral-600">
			{page.status}
		</p>
		<h1 class="mt-3 text-lg font-medium">{heading}</h1>
		{#if page.error?.message && page.error.message !== heading}
			<p class="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">{page.error.message}</p>
		{/if}
		<Button href="/dashboard" class="mt-6">Go to Home</Button>
	</div>
</div>
