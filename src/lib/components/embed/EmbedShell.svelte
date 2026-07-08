<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { EmbedTheme } from '$lib/embeds';

	let {
		title,
		href,
		theme = 'auto',
		accent = null,
		showHeader = true,
		showFooter = true,
		children
	}: {
		title: string;
		href: string;
		theme?: EmbedTheme;
		accent?: string | null;
		showHeader?: boolean;
		showFooter?: boolean;
		children: Snippet;
	} = $props();

	const accentStyle = $derived(accent ? `--accent:${accent};` : '');
</script>

<svelte:head><title>{title}</title></svelte:head>

<div class="embed" data-theme={theme} style={accentStyle}>
	{#if showHeader}
		<div class="hd">
			<span class="ti">{title}</span>
			<a {href} target="_blank" rel="noreferrer">Open ↗</a>
		</div>
	{/if}
	<div class="body">
		{@render children()}
	</div>
	{#if showFooter}
		<a class="ft" href="https://track.devinfritz.de" target="_blank" rel="noreferrer">Powered by OpenTrack</a>
	{/if}
</div>

<style>
	:global(body) { margin: 0; }
	.embed {
		--bg: #ffffff;
		--fg: #1f2937;
		--muted: #9ca3af;
		--border: #e5e7eb;
		--border-hover: #c7cbd1;
		--accent: #6366f1;
		font-family: ui-sans-serif, system-ui, sans-serif;
		padding: 12px;
		color: var(--fg);
		background: var(--bg);
		box-sizing: border-box;
	}
	.embed[data-theme='dark'] {
		--bg: #0a0a0a;
		--fg: #e5e7eb;
		--muted: #6b7280;
		--border: #262626;
		--border-hover: #404040;
	}
	@media (prefers-color-scheme: dark) {
		.embed[data-theme='auto'] {
			--bg: #0a0a0a;
			--fg: #e5e7eb;
			--muted: #6b7280;
			--border: #262626;
			--border-hover: #404040;
		}
	}
	.hd { display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 13px; margin-bottom: 10px; gap: 8px; }
	.ti { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.hd a { color: var(--accent); text-decoration: none; font-weight: 500; font-size: 12px; flex-shrink: 0; }
	.ft { display: block; margin-top: 10px; text-align: center; font-size: 10px; color: var(--muted); text-decoration: none; }
</style>
