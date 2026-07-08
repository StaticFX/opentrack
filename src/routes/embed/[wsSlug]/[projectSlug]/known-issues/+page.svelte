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
	{#each data.items as it (it.id)}
		<a class="row" href={`${data.href}/${it.id}`} target="_blank" rel="noreferrer">
			<span class="dot"></span>
			<span class="ti">{it.title}</span>
			{#if it.votes}<span class="votes">▲ {it.votes}</span>{/if}
		</a>
	{:else}
		<div class="empty">No known issues. 🎉</div>
	{/each}
</EmbedShell>

<style>
	.row { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 6px; text-decoration: none; color: inherit; }
	.row:hover { border-color: var(--border-hover); }
	.dot { flex-shrink: 0; width: 7px; height: 7px; border-radius: 999px; background: #f97316; }
	.ti { flex: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.votes { flex-shrink: 0; font-size: 10px; color: var(--muted); }
	.empty { color: var(--muted); font-size: 12px; padding: 12px; text-align: center; }
</style>
