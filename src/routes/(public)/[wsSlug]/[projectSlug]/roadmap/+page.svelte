<script lang="ts">
	import { ArrowRight, MessageSquare, Map } from '@lucide/svelte';
	import EmptyState from '$lib/components/public/EmptyState.svelte';
	import PublicMeta from '$lib/components/public/PublicMeta.svelte';

	let { data } = $props();

	const base = $derived(`/${data.workspace.slug}/${data.project.slug}`);
	// Status is the only semantic colour here — fixed glyph/colour per lane
	// (not the board column's own colour), matching the landing's MonoRoadmap
	// preview so Home and the full roadmap read as the same document.
	const laneMeta: Record<string, { glyph: string; color: string; blurb: string }> = {
		planned: { glyph: '○', color: 'var(--dim)', blurb: 'On the list' },
		in_progress: { glyph: '◐', color: 'var(--amber)', blurb: 'Being built now' },
		shipped: { glyph: '●', color: 'var(--green)', blurb: 'Out in the wild' }
	};
	const total = $derived(data.lanes.reduce((n, l) => n + l.count, 0));

	const SHIPPED_CAP = 6;
</script>

<PublicMeta
	title={`${data.project.name} roadmap`}
	description={`What's planned, what's being built, and what's shipped for ${data.project.name}.`}
/>

<main class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
	{#if total === 0}
		<div class="py-10">
			<EmptyState icon={Map} title="The map is still being drawn" body="Nothing on the roadmap yet — check back soon." />
		</div>
	{:else}
		<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
			<p class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Roadmap</p>
			<span class="text-[11px] tabular-nums text-[var(--faint)]">{total} {total === 1 ? 'item' : 'items'}</span>
		</div>

		<!-- Journey bar: planned → in progress → shipped, in the same fixed status colours as the lanes below. -->
		<div class="mt-3 flex h-1 overflow-hidden bg-[var(--rule)]">
			{#each data.lanes as lane (lane.key)}
				{#if lane.count}
					<div class="h-full" style={`width:${(lane.count / total) * 100}%;background:${laneMeta[lane.key].color}`} title={`${lane.title}: ${lane.count}`}></div>
				{/if}
			{/each}
		</div>

		<div class="mt-8 grid gap-x-8 gap-y-10 border-t border-[var(--rule)] pt-8 md:grid-cols-3">
			{#each data.lanes as lane (lane.key)}
				{@const meta = laneMeta[lane.key]}
				{@const shown = lane.key === 'shipped' ? lane.items.slice(0, SHIPPED_CAP) : lane.items}
				<section>
					<h2 class="flex items-baseline gap-2 text-[12px] tracking-wide uppercase">
						<span style={`color:${meta.color}`} aria-hidden="true">{meta.glyph}</span>
						<span class="text-[var(--text)]">{lane.title}</span>
						<span class="ml-auto tabular-nums text-[var(--faint)]">{lane.count.toString().padStart(2, '0')}</span>
					</h2>
					<p class="mt-1 text-[11px] text-[var(--faint)]">{meta.blurb}</p>

					<ul class="mt-4">
						{#each shown as t (t.number)}
							<li class="border-t border-[var(--rule)]">
								<a
									href={`${base}/t/${t.number}`}
									class="mono-focus group block py-3"
									style={`view-transition-name: t-${t.number}`}
								>
									<span class="flex items-baseline gap-2 text-[13px]">
										<span class="shrink-0 tabular-nums text-[var(--faint)]">#{t.number}</span>
										<span class="min-w-0 flex-1 truncate text-[var(--text)] transition-colors group-hover:text-[var(--accent)]">{t.title}</span>
										{#if t.votes > 0}
											<span class="shrink-0 text-[11px] tabular-nums text-[var(--faint)]">▲{t.votes}</span>
										{/if}
									</span>
									{#if t.labels.length || t.comments}
										<span class="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-[3.2ch] text-[10px] text-[var(--faint)]">
											{#each t.labels as l (l.id)}
												<span style={`color:${l.color}`}>#{l.name}</span>
											{/each}
											{#if t.comments}
												<span class="flex items-center gap-1"><MessageSquare size={10} /> {t.comments}</span>
											{/if}
										</span>
									{/if}
								</a>
							</li>
						{:else}
							<li class="border-t border-[var(--rule)] py-8 text-center text-[12px] text-[var(--faint)]">— nothing here yet</li>
						{/each}
						{#if lane.key === 'shipped' && lane.items.length > 0}
							<li class="border-t border-[var(--rule)]">
								<a
									href={`${base}/releases`}
									class="mono-focus flex items-center justify-center gap-1 py-2.5 text-[11px] tracking-tight text-[var(--faint)] transition-colors hover:text-[var(--accent)]"
								>
									see releases <ArrowRight size={11} />
								</a>
							</li>
						{/if}
					</ul>
				</section>
			{/each}
		</div>
	{/if}
</main>
