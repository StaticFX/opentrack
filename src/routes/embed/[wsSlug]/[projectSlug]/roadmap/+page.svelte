<script lang="ts">
	import EmbedShell from '$lib/components/embed/EmbedShell.svelte';
	let { data } = $props();
	// Status is the only semantic colour here — a fixed glyph/colour per lane,
	// matching the public roadmap page rather than a per-column hex.
	const laneMeta: Record<string, { glyph: string; color: string }> = {
		planned: { glyph: '○', color: 'var(--dim)' },
		in_progress: { glyph: '◐', color: 'var(--amber)' },
		shipped: { glyph: '●', color: 'var(--green)' }
	};
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
			{@const meta = laneMeta[lane.key] ?? { glyph: '○', color: 'var(--dim)' }}
			<div class="lane">
				<div class="lane-hd">
					<span class="glyph" style={`color:${meta.color}`} aria-hidden="true">{meta.glyph}</span>
					<span class="lt">{lane.title}</span>
					<span class="ct">{lane.count}</span>
				</div>
				<div class="items">
					{#each lane.items as t (t.number)}
						<a class="item" href={data.href} target="_blank" rel="noreferrer">
							<span class="num">#{t.number}</span><span class="ti">{t.title}</span>
							{#if t.votes}<span class="vt">▲ {t.votes}</span>{/if}
						</a>
					{:else}
						<div class="empty">—</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</EmbedShell>

<style>
	.lanes {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
	}
	@media (max-width: 520px) {
		.lanes {
			grid-template-columns: 1fr;
		}
	}
	.lane-hd {
		display: flex;
		align-items: baseline;
		gap: 6px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--rule);
		margin-bottom: 6px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}
	.glyph {
		font-size: 10px;
	}
	.lt {
		color: var(--text);
	}
	.ct {
		margin-left: auto;
		font-family: var(--font-jb);
		font-size: 11px;
		font-weight: 400;
		text-transform: none;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
		color: var(--faint);
	}
	.item {
		display: flex;
		align-items: baseline;
		gap: 6px;
		padding: 5px 0;
		border-bottom: 1px solid var(--rule);
		text-decoration: none;
		color: inherit;
		font-size: 12px;
	}
	.num {
		flex-shrink: 0;
		font-family: var(--font-jb);
		font-size: 10px;
		letter-spacing: -0.01em;
		color: var(--faint);
	}
	.ti {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text);
		transition: color 0.15s;
	}
	.item:hover .ti {
		color: var(--accent);
	}
	.vt {
		flex-shrink: 0;
		font-family: var(--font-jb);
		font-size: 10px;
		letter-spacing: -0.01em;
		font-variant-numeric: tabular-nums;
		color: var(--faint);
	}
	.empty {
		padding: 5px 0;
		color: var(--faint);
		font-size: 12px;
		opacity: 0.7;
	}
</style>
