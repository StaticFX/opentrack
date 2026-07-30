<script lang="ts">
	import { renderMarkdown } from '$lib/markdown';
	import LangToggle from '$lib/components/public/LangToggle.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.lang === 'de' ? 'Datenschutzerklärung' : 'Privacy Policy'}</title></svelte:head>

<main class="mx-auto max-w-3xl px-4 py-14 sm:px-6">
	<div class="flex items-center justify-between gap-4">
		<p class="mono-display text-[11px] tracking-[0.2em] text-[var(--faint)]">
			{data.lang === 'de' ? 'RECHTLICHES' : 'LEGAL'}
		</p>
		<LangToggle lang={data.lang} />
	</div>
	<div class="prose prose-sm prose-invert mt-4 max-w-none">
		{@html renderMarkdown(data.body)}
	</div>
</main>
