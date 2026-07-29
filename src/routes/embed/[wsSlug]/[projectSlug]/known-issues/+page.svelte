<script lang="ts">
	import EmbedShell from '$lib/components/embed/EmbedShell.svelte';
	let { data } = $props();
</script>

<EmbedShell
	title={`${data.project.name} · Known issues`}
	href={data.href}
	theme={data.embed.theme}
	accent={data.embed.accent}
	showHeader={data.embed.showHeader}
	showFooter={data.embed.showFooter}
>
	<div class="list">
		{#each data.items as it (it.id)}
			<a class="row" href={`${data.href}/${it.id}`} target="_blank" rel="noreferrer">
				<span class="dot" aria-hidden="true">●</span>
				<span class="ti">{it.title}</span>
				{#if it.votes}<span class="votes">▲ {it.votes}</span>{/if}
			</a>
		{:else}
			<div class="empty">No known issues.</div>
		{/each}
	</div>
</EmbedShell>

<style>
	/* Flat hairline rows. Status is the one semantic colour — a fixed amber
	   glyph, not a hardcoded hex dot — matching the public roadmap's
	   glyph-per-status convention (○ planned / ◐ in progress / ● shipped). */
	.list {
		border-top: 1px solid var(--rule);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 2px;
		border-bottom: 1px solid var(--rule);
		text-decoration: none;
		color: inherit;
	}
	.dot {
		flex-shrink: 0;
		font-size: 8px;
		color: var(--amber);
	}
	.ti {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12px;
		color: var(--text);
		transition: color 0.15s;
	}
	.row:hover .ti {
		color: var(--accent);
	}
	.votes {
		flex-shrink: 0;
		font-family: var(--font-jb);
		font-size: 10px;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
		color: var(--faint);
	}
	.empty {
		padding: 16px 2px;
		color: var(--faint);
		font-size: 12px;
		text-align: center;
	}
</style>
