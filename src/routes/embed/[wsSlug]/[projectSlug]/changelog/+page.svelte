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
	{#each data.releases as r (r.version)}
		<a class="rel" href={data.href} target="_blank" rel="noreferrer">
			<span class="tag">{r.version}</span>
			{#if r.name}<span class="nm">{r.name}</span>{/if}
			{#if r.releasedAt}<span class="dt">{new Date(r.releasedAt).toLocaleDateString()}</span>{/if}
		</a>
	{:else}
		<div class="empty">No releases yet.</div>
	{/each}
</EmbedShell>

<style>
	.rel { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 6px; text-decoration: none; color: inherit; }
	.rel:hover { border-color: var(--border-hover); }
	.tag { font-weight: 600; font-size: 13px; color: var(--accent); }
	.nm { flex: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.dt { font-size: 11px; color: var(--muted); margin-left: auto; }
	.empty { color: var(--muted); font-size: 12px; padding: 12px; text-align: center; }
</style>
