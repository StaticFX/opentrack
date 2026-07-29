<script lang="ts">
	import EmbedShell from '$lib/components/embed/EmbedShell.svelte';
	import { SUGGESTION_KIND_META } from '$lib/suggestionKind';
	let { data } = $props();
</script>

<EmbedShell
	title={`${data.project.name} · Feedback`}
	href={data.href}
	theme={data.embed.theme}
	accent={data.embed.accent}
	showHeader={data.embed.showHeader}
	showFooter={data.embed.showFooter}
>
	<div class="list">
		{#each data.items as it (it.id)}
			{@const km = SUGGESTION_KIND_META[it.kind]}
			<a class="row" href={`${data.href}/${it.id}`} target="_blank" rel="noreferrer">
				<span class="votes">▲ {it.votes}</span>
				<span class="kind" style={`color:${km.color}`}>{km.label}</span>
				<span class="ti">{it.title}</span>
			</a>
		{:else}
			<div class="empty">No feedback yet.</div>
		{/each}
	</div>
</EmbedShell>

<style>
	/* Flat hairline rows. Kind stays a semantic colour, but only as a text tint
	   on a hairline chip — never a filled/saturated pill — matching how the
	   public suggestions list tints its kind icon rather than boxing it. */
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
	.votes {
		flex-shrink: 0;
		min-width: 34px;
		font-family: var(--font-jb);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
		color: var(--faint);
	}
	.kind {
		flex-shrink: 0;
		border: 1px solid var(--rule);
		padding: 1px 6px;
		font-family: var(--font-jb);
		font-size: 10px;
		letter-spacing: 0.02em;
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
	.empty {
		padding: 16px 2px;
		color: var(--faint);
		font-size: 12px;
		text-align: center;
	}
</style>
