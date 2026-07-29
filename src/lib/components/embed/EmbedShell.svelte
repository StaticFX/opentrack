<script lang="ts">
	import '@fontsource/space-mono/700.css';
	import '@fontsource-variable/jetbrains-mono';
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
			<span class="ti mono-display">{title}</span>
			<a class="open" {href} target="_blank" rel="noreferrer">Open ↗</a>
		</div>
	{/if}
	<div class="body">
		{@render children()}
	</div>
	{#if showFooter}
		<a class="ft" href="https://track.devinfritz.de" target="_blank" rel="noreferrer">// Powered by OpenTrack</a>
	{/if}
</div>

<style>
	/* Self-contained mono token set — this widget renders standalone in a
	   third-party iframe (its own route, outside both the (public) and (app)
	   layout groups), so it never reaches for .ot-mono / src/app.css tokens.
	   Mirrors the shared mono spec 1:1 (--ground/--raised/--text/--dim/--faint/
	   --rule/--accent/--green/--amber, Space Mono display + JetBrains Mono body)
	   so a framed widget reads as the same document as the site it links out to
	   — just with a light variant added, since embeds sit on third-party pages
	   and can't always commit to a dark ground the way the product can. */
	:global(body) {
		margin: 0;
	}
	.embed {
		--ground: #ffffff;
		--raised: #f5f5f3;
		--text: #141416;
		--dim: #57574f;
		--faint: #85857c;
		--rule: rgba(0, 0, 0, 0.1);
		--accent: #3b5bff; /* blueprint cobalt default, overridden by project accent */
		--green: #1a7f37;
		--amber: #9a6700;
		--font-space: 'Space Mono', ui-monospace, 'SF Mono', monospace;
		--font-jb: 'JetBrains Mono Variable', ui-monospace, 'SF Mono', monospace;

		box-sizing: border-box;
		padding: 12px;
		color: var(--text);
		background: var(--ground);
		font-family: var(--font-jb);
		font-size: 13px;
		line-height: 1.5;
		-webkit-font-smoothing: antialiased;
	}
	.embed :global(*) {
		box-sizing: border-box;
	}
	.embed[data-theme='dark'] {
		--ground: #0b0b0c;
		--raised: #141416;
		--text: #ecece6;
		--dim: #9a9a93;
		--faint: #7d7d76;
		--rule: rgba(255, 255, 255, 0.09);
		--green: #3fb950;
		--amber: #d29922;
	}
	@media (prefers-color-scheme: dark) {
		.embed[data-theme='auto'] {
			--ground: #0b0b0c;
			--raised: #141416;
			--text: #ecece6;
			--dim: #9a9a93;
			--faint: #7d7d76;
			--rule: rgba(255, 255, 255, 0.09);
			--green: #3fb950;
			--amber: #d29922;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.embed :global(*) {
			transition: none !important;
			animation: none !important;
		}
	}
	/* One consistent cobalt focus ring for every interactive element the child
	   pages render inside the body snippet (rows / links are theirs, the ring
	   is ours — matches the app's shared .mono-focus convention). */
	.embed :global(a:focus-visible),
	.embed :global(button:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		border-radius: 2px;
	}

	.mono-display {
		font-family: var(--font-space);
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.hd {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 10px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--rule);
		font-size: 13px;
	}
	.ti {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text);
	}
	.open {
		flex-shrink: 0;
		color: var(--faint);
		font-family: var(--font-jb);
		font-size: 11px;
		letter-spacing: -0.01em;
		text-decoration: none;
		transition: color 0.15s;
	}
	.open:hover {
		color: var(--accent);
	}
	.ft {
		display: block;
		margin-top: 10px;
		color: var(--faint);
		font-size: 10px;
		letter-spacing: 0.04em;
		text-decoration: none;
		text-align: center;
		transition: color 0.15s;
	}
	.ft:hover {
		color: var(--dim);
	}
</style>
