<script lang="ts">
	import EmbedShell from '$lib/components/embed/EmbedShell.svelte';
	let { data } = $props();
	const laneColor: Record<string, string> = { planned: '#3b82f6', in_progress: '#f59e0b', shipped: '#22c55e' };
</script>

<EmbedShell
	title={`${data.project.name} · Roadmap`}
	href={data.href}
	theme={data.embed.theme}
	accent={data.embed.accent}
	showHeader={data.embed.showHeader}
	showFooter={data.embed.showFooter}
>
	<div class="lanes">
		{#each data.lanes as lane (lane.key)}
			<div class="lane">
				<div class="lane-hd"><span class="dot" style={`background:${laneColor[lane.key]}`}></span>{lane.title}<span class="ct">{lane.count}</span></div>
				{#each lane.items as t (t.number)}
					<a class="item" href={data.href} target="_blank" rel="noreferrer">
						<span class="num">#{t.number}</span><span class="ti">{t.title}</span>
						{#if t.votes}<span class="vt">▲ {t.votes}</span>{/if}
					</a>
				{:else}
					<div class="empty">—</div>
				{/each}
			</div>
		{/each}
	</div>
</EmbedShell>

<style>
	.lanes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
	@media (max-width: 520px) { .lanes { grid-template-columns: 1fr; } }
	.lane-hd { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; margin-bottom: 6px; }
	.dot { width: 8px; height: 8px; border-radius: 999px; }
	.ct { color: var(--muted); font-weight: 400; }
	.item { display: flex; align-items: baseline; gap: 5px; padding: 5px 7px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 5px; text-decoration: none; color: inherit; font-size: 12px; }
	.item:hover { border-color: var(--border-hover); }
	.num { color: var(--muted); font-family: ui-monospace, monospace; font-size: 10px; }
	.ti { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.vt { color: var(--muted); font-size: 10px; }
	.empty { color: var(--muted); font-size: 12px; padding: 4px 7px; opacity: 0.6; }
</style>
