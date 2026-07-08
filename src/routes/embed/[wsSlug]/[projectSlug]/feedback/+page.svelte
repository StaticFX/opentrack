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
	{#each data.items as it (it.id)}
		{@const km = SUGGESTION_KIND_META[it.kind]}
		<a class="row" href={`${data.href}/${it.id}`} target="_blank" rel="noreferrer">
			<span class="votes">▲ {it.votes}</span>
			<span class="kind" style={`color:${km.color};background:${km.color}22`}>{km.label}</span>
			<span class="ti">{it.title}</span>
		</a>
	{:else}
		<div class="empty">No feedback yet.</div>
	{/each}
</EmbedShell>

<style>
	.row { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 6px; text-decoration: none; color: inherit; }
	.row:hover { border-color: var(--border-hover); }
	.votes { flex-shrink: 0; min-width: 32px; font-size: 11px; font-weight: 600; color: var(--muted); }
	.kind { flex-shrink: 0; border-radius: 999px; padding: 1px 7px; font-size: 10px; font-weight: 600; }
	.ti { flex: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.empty { color: var(--muted); font-size: 12px; padding: 12px; text-align: center; }
</style>
