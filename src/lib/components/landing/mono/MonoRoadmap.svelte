<!--
	MonoRoadmap — the showcase project's REAL public roadmap (planned → in progress
	→ shipped), derived server-side by the same buildRoadmapLanes() the live roadmap
	page uses. Three mono columns, hairline-separated, no boxes. Status carries the
	only semantic colour on the page: amber for in progress, green for shipped. Every
	row deep-links to its real ticket.
-->
<script lang="ts">
	import type { RoadmapLane } from '$lib/roadmap';

	type Props = { lanes: RoadmapLane[]; base: string };
	let { lanes, base }: Props = $props();

	const meta: Record<string, { glyph: string; color: string }> = {
		planned: { glyph: '○', color: 'var(--dim)' },
		in_progress: { glyph: '◐', color: 'var(--amber)' },
		shipped: { glyph: '●', color: 'var(--green)' }
	};
	const CAP = 6;
</script>

<section id="roadmap" class="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
	<p class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">02 // Roadmap</p>
	<div class="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
		<h2 class="mono-display max-w-2xl text-2xl leading-tight tracking-tight text-[var(--text)] sm:text-4xl">
			Planned, in progress, and shipped — in public.
		</h2>
		<a
			href={`${base}/roadmap`}
			class="mono-focus shrink-0 text-[13px] tracking-tight text-[var(--dim)] transition-colors hover:text-[var(--accent)]"
		>
			Full roadmap →
		</a>
	</div>

	<div class="mt-10 grid gap-x-8 gap-y-10 border-t border-[var(--rule)] pt-8 md:grid-cols-3">
		{#each lanes as lane (lane.key)}
			{@const m = meta[lane.key] ?? meta.planned}
			<section>
				<h3 class="flex items-baseline gap-2 text-[12px] tracking-wide uppercase">
					<span style={`color:${m.color}`} aria-hidden="true">{m.glyph}</span>
					<span class="text-[var(--text)]">{lane.title}</span>
					<span class="ml-auto tabular-nums text-[var(--faint)]">
						{lane.count.toString().padStart(2, '0')}
					</span>
				</h3>
				<ul class="mt-3">
					{#each lane.items.slice(0, CAP) as t (t.number)}
						<li class="border-t border-[var(--rule)]">
							<a
								href={`${base}/t/${t.number}`}
								class="mono-focus flex items-baseline gap-2 py-2.5 text-[13px] transition-colors hover:text-[var(--accent)]"
							>
								<span class="shrink-0 tabular-nums text-[var(--faint)]">#{t.number}</span>
								<span class="min-w-0 flex-1 truncate text-[var(--dim)]">{t.title}</span>
								{#if t.votes > 0}
									<span class="shrink-0 text-[11px] tabular-nums text-[var(--faint)]">▲{t.votes}</span>
								{/if}
							</a>
						</li>
					{:else}
						<li class="border-t border-[var(--rule)] py-2.5 text-[12px] text-[var(--faint)]">— nothing here yet</li>
					{/each}
					{#if lane.count > CAP}
						<li class="border-t border-[var(--rule)]">
							<a
								href={`${base}/roadmap`}
								class="mono-focus block py-2.5 text-[12px] text-[var(--faint)] transition-colors hover:text-[var(--accent)]"
							>
								+{lane.count - CAP} more →
							</a>
						</li>
					{/if}
				</ul>
			</section>
		{/each}
	</div>
</section>
