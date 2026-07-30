<script lang="ts">
	import { renderMarkdown } from '$lib/markdown';

	let { data } = $props();
</script>

<svelte:head><title>Datenschutzerklärung</title></svelte:head>

<main class="mx-auto max-w-3xl px-4 py-14 sm:px-6">
	<p class="mono-display text-[11px] tracking-[0.2em] text-[var(--faint)]">RECHTLICHES</p>
	<div class="prose prose-sm prose-invert mt-4 max-w-none">
		{@html renderMarkdown(data.body)}
	</div>
</main>
