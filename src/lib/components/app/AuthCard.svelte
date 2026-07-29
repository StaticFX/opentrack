<script lang="ts">
	import '@fontsource/space-mono/400.css';
	import '@fontsource/space-mono/700.css';
	import '@fontsource-variable/jetbrains-mono';
	import spaceUrl from '@fontsource/space-mono/files/space-mono-latin-700-normal.woff2?url';
	import jbUrl from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url';
	import type { Snippet } from 'svelte';

	// Shared shell for the invite + setup flows (login is its own immersive
	// mono page — see landing/auth-b/Hero.svelte, untouched by this). These
	// routes render outside the app shell entirely, so this owns the whole
	// page: the .ot-mono ink ground, brand wordmark, and the flat hairline
	// panel the form sits in. No card soup, no gradients — a document on ink.
	let { title, sub, children }: { title: string; sub?: string; children: Snippet } = $props();
</script>

<svelte:head>
	<link rel="preload" as="font" type="font/woff2" href={spaceUrl} crossorigin="anonymous" />
	<link rel="preload" as="font" type="font/woff2" href={jbUrl} crossorigin="anonymous" />
</svelte:head>

<main class="ot-mono flex min-h-dvh items-center justify-center px-4 py-12">
	<div class="ot-rise flex w-full max-w-sm flex-col gap-8">
		<div class="flex flex-col items-center gap-1 text-center">
			<span class="mono-display text-[15px] tracking-tight text-[var(--text)]">OpenTrack</span>
			<span class="text-[11px] tracking-tight text-[var(--faint)]">/ issue tracker</span>
		</div>

		<div class="flex flex-col gap-6 border-t border-[var(--rule)] pt-8">
			<div class="flex flex-col items-center gap-1.5 text-center">
				<h1 class="mono-display text-xl text-[var(--text)]">{title}</h1>
				{#if sub}
					<p class="text-[13px] text-[var(--dim)]">{sub}</p>
				{/if}
			</div>
			{@render children()}
		</div>
	</div>
</main>
