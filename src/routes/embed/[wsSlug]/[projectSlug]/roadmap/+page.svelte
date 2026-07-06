<script lang="ts">
	let { data } = $props();
	const laneColor: Record<string, string> = { planned: '#3b82f6', in_progress: '#f59e0b', shipped: '#22c55e' };
</script>

<svelte:head><title>{data.project.name} — Roadmap</title></svelte:head>

<div class="embed">
	<div class="hd">
		<span>{data.project.name} · Roadmap</span>
		<a href={data.href} target="_blank" rel="noreferrer">Open ↗</a>
	</div>
	<div class="lanes">
		{#each data.lanes as lane (lane.key)}
			<div class="lane">
				<div class="lane-hd"><span class="dot" style={`background:${laneColor[lane.key]}`}></span>{lane.title}<span class="ct">{lane.count}</span></div>
				{#each lane.items.slice(0, 8) as t (t.number)}
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
	<a class="ft" href="https://track.devinfritz.de" target="_blank" rel="noreferrer">Powered by OpenTrack</a>
</div>

<style>
	:global(body) { margin: 0; }
	.embed {
		font-family: ui-sans-serif, system-ui, sans-serif;
		padding: 12px;
		color: #1f2937;
		background: #fff;
		box-sizing: border-box;
	}
	.hd { display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 13px; margin-bottom: 10px; }
	.hd a { color: #6366f1; text-decoration: none; font-weight: 500; font-size: 12px; }
	.lanes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
	.lane-hd { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; margin-bottom: 6px; }
	.dot { width: 8px; height: 8px; border-radius: 999px; }
	.ct { color: #9ca3af; font-weight: 400; }
	.item { display: flex; align-items: baseline; gap: 5px; padding: 5px 7px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 5px; text-decoration: none; color: inherit; font-size: 12px; }
	.item:hover { border-color: #c7cbd1; }
	.num { color: #9ca3af; font-family: ui-monospace, monospace; font-size: 10px; }
	.ti { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.vt { color: #9ca3af; font-size: 10px; }
	.empty { color: #d1d5db; font-size: 12px; padding: 4px 7px; }
	.ft { display: block; margin-top: 10px; text-align: center; font-size: 10px; color: #9ca3af; text-decoration: none; }
	@media (prefers-color-scheme: dark) {
		.embed { color: #e5e7eb; background: #0a0a0a; }
		.item { border-color: #262626; }
		.item:hover { border-color: #404040; }
	}
</style>
