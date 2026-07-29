<script lang="ts">
	import EmbedShell from '$lib/components/embed/EmbedShell.svelte';
	let { data } = $props();
</script>

<EmbedShell
	title={`${data.project.name} · Releases`}
	href={data.href}
	theme={data.embed.theme}
	accent={data.embed.accent}
	showHeader={data.embed.showHeader}
	showFooter={data.embed.showFooter}
>
	<div class="list">
		{#each data.releases as r (r.version)}
			<a class="rel" href={data.href} target="_blank" rel="noreferrer">
				<span class="tag">{r.version}</span>
				{#if r.name}<span class="nm">{r.name}</span>{/if}
				{#if r.releasedAt}<span class="dt">{new Date(r.releasedAt).toLocaleDateString()}</span>{/if}
			</a>
		{:else}
			<div class="empty">No releases yet.</div>
		{/each}
	</div>
</EmbedShell>

<style>
	/* Flat hairline rows — no cards, no radius. Version reads as the one "key
	   number" per row, so it gets the restrained cobalt accent; everything
	   else stays dim/faint mono text. */
	.list {
		border-top: 1px solid var(--rule);
	}
	.rel {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 8px 2px;
		border-bottom: 1px solid var(--rule);
		text-decoration: none;
		color: inherit;
	}
	.tag {
		flex-shrink: 0;
		font-family: var(--font-space);
		font-weight: 700;
		font-size: 13px;
		letter-spacing: -0.01em;
		color: var(--accent);
	}
	.nm {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12px;
		color: var(--dim);
		transition: color 0.15s;
	}
	.rel:hover .nm {
		color: var(--text);
	}
	.dt {
		flex-shrink: 0;
		font-family: var(--font-jb);
		font-size: 11px;
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
