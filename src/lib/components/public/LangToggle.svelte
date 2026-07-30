<script lang="ts">
	import { page } from '$app/state';
	import type { Lang } from '$lib/server/legal';

	// EN/DE switch for the legal pages. Language is driven by the `?lang` URL param
	// (SSR-correct, shareable, works without JS); on click we also persist the
	// choice in localStorage so the cookie banner follows the same language.
	let { lang }: { lang: Lang } = $props();

	const items: { code: Lang; label: string }[] = [
		{ code: 'en', label: 'EN' },
		{ code: 'de', label: 'DE' }
	];

	function href(code: Lang): string {
		return `${page.url.pathname}?lang=${code}`;
	}
	function remember(code: Lang) {
		try {
			localStorage.setItem('ot:lang', code);
		} catch {
			/* ignore */
		}
	}
</script>

<div class="inline-flex items-center gap-1 text-[12px]" role="group" aria-label="Language">
	{#each items as it, i (it.code)}
		{#if i > 0}<span class="text-[var(--faint)]" aria-hidden="true">·</span>{/if}
		{#if it.code === lang}
			<span class="tracking-tight text-[var(--accent)]" aria-current="true">{it.label}</span>
		{:else}
			<a
				href={href(it.code)}
				onclick={() => remember(it.code)}
				data-sveltekit-noscroll
				class="mono-focus tracking-tight text-[var(--faint)] transition-colors hover:text-[var(--accent)]"
			>
				{it.label}
			</a>
		{/if}
	{/each}
</div>
