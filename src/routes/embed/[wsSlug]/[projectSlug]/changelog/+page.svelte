<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>{data.project.name} — Changelog</title></svelte:head>

<div class="embed">
	<div class="hd">
		<span>{data.project.name} · Changelog</span>
		<a href={data.href} target="_blank" rel="noreferrer">Open ↗</a>
	</div>
	{#each data.releases as r (r.version)}
		<a class="rel" href={data.href} target="_blank" rel="noreferrer">
			<span class="tag">{r.version}</span>
			{#if r.name}<span class="nm">{r.name}</span>{/if}
			{#if r.releasedAt}<span class="dt">{new Date(r.releasedAt).toLocaleDateString()}</span>{/if}
		</a>
	{:else}
		<div class="empty">No releases yet.</div>
	{/each}
	<a class="ft" href="https://track.devinfritz.de" target="_blank" rel="noreferrer">Powered by OpenTrack</a>
</div>

<style>
	:global(body) { margin: 0; }
	.embed { font-family: ui-sans-serif, system-ui, sans-serif; padding: 12px; color: #1f2937; background: #fff; box-sizing: border-box; }
	.hd { display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 13px; margin-bottom: 10px; }
	.hd a { color: #6366f1; text-decoration: none; font-weight: 500; font-size: 12px; }
	.rel { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 6px; text-decoration: none; color: inherit; }
	.rel:hover { border-color: #c7cbd1; }
	.tag { font-weight: 600; font-size: 13px; color: #14b8a6; }
	.nm { flex: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.dt { font-size: 11px; color: #9ca3af; margin-left: auto; }
	.empty { color: #9ca3af; font-size: 12px; padding: 12px; text-align: center; }
	.ft { display: block; margin-top: 10px; text-align: center; font-size: 10px; color: #9ca3af; text-decoration: none; }
	@media (prefers-color-scheme: dark) {
		.embed { color: #e5e7eb; background: #0a0a0a; }
		.rel { border-color: #262626; }
		.rel:hover { border-color: #404040; }
	}
</style>
