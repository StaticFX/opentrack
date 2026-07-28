<script lang="ts">
	import { PRIORITY_META } from '$lib/priority';
	import ProjectPageHeader from '$lib/components/app/ProjectPageHeader.svelte';
	import SpotlightCard from '$lib/components/vendor/SpotlightCard.svelte';

	let { data } = $props();
	const a = $derived(data.analytics);

	const weeklyMax = $derived(Math.max(1, ...a.weekly.flatMap((w) => [w.opened, w.closed])));
	const priMax = $derived(Math.max(1, ...a.byPriority.map((p) => p.count)));
	const labelMax = $derived(Math.max(1, ...a.byLabel.map((l) => l.count)));
	const cycle = $derived(a.cycleTimeDays == null ? '—' : `${a.cycleTimeDays.toFixed(1)}d`);

	const stats = $derived([
		{ label: 'Total tickets', value: a.totals.total, accent: false },
		{ label: 'Open', value: a.totals.open, accent: true },
		{ label: 'Closed', value: a.totals.closed, accent: false },
		{ label: 'Avg cycle time', value: cycle, accent: false }
	]);
</script>

<svelte:head><title>Analytics — {data.project.name}</title></svelte:head>

<div class="flex h-full flex-col">
	<ProjectPageHeader section="Analytics" />
	<div class="min-h-0 flex-1 overflow-y-auto">
		{#if a.totals.total === 0}
			<div class="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
				<div class="rounded-2xl bg-black/[0.03] py-20 text-center dark:bg-white/[0.04]">
					<p class="text-sm text-neutral-400">No ticket data yet.</p>
					<p class="mt-1 font-mono text-[11px] text-neutral-400 dark:text-neutral-500">Analytics appear once tickets are created and moved.</p>
				</div>
			</div>
		{:else}
			<div class="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
				<!-- Stat tiles -->
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{#each stats as s, i (s.label)}
						<SpotlightCard class="pub-card ot-rise px-4 py-3.5" style={`--rise-i:${i}`}>
							<p class={`font-mono text-2xl font-bold tabular-nums ${s.accent ? 'text-[var(--accent-fg)]' : ''}`}>{s.value}</p>
							<p class="pub-label mt-1">{s.label}</p>
						</SpotlightCard>
					{/each}
				</div>

				<!-- Opened vs closed, weekly -->
				<section class="pub-card ot-rise mt-6 p-5" style="--rise-i:4">
					<div class="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
						<h2 class="pub-label">Opened vs. closed</h2>
						<div class="flex items-center gap-3 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
							<span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm" style="background:var(--accent)"></span> opened</span>
							<span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-green-500"></span> closed</span>
							<span class="text-neutral-400 dark:text-neutral-500">last {a.weekly.length} weeks</span>
						</div>
					</div>
					<div class="flex items-end gap-2" style="height:160px">
						{#each a.weekly as w (w.label)}
							<div class="flex flex-1 flex-col items-center gap-1">
								<div class="flex h-full w-full items-end justify-center gap-1">
									<div class="w-3 rounded-t sm:w-4" style={`height:${(w.opened / weeklyMax) * 100}%;background:var(--accent)`} title={`${w.opened} opened`}></div>
									<div class="w-3 rounded-t bg-green-500 sm:w-4" style={`height:${(w.closed / weeklyMax) * 100}%`} title={`${w.closed} closed`}></div>
								</div>
								<span class="font-mono text-[10px] text-neutral-400">{w.label}</span>
							</div>
						{/each}
					</div>
				</section>

				<div class="mt-6 grid gap-6 sm:grid-cols-2">
					<!-- Priority -->
					<section class="pub-card ot-rise p-5" style="--rise-i:5">
						<h2 class="pub-label mb-4">By priority</h2>
						{#if a.byPriority.length}
							<div class="space-y-3">
								{#each a.byPriority as p (p.priority)}
									{@const meta = PRIORITY_META[p.priority as keyof typeof PRIORITY_META]}
									<div class="flex items-center gap-2.5">
										<span class="w-16 shrink-0 text-[13px] text-neutral-500 dark:text-neutral-400">{meta?.label ?? p.priority}</span>
										<div class="h-2.5 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
											<div class="h-full rounded-full transition-all duration-500" style={`width:${(p.count / priMax) * 100}%;background:${meta?.color ?? '#9ca3af'}`}></div>
										</div>
										<span class="w-7 shrink-0 text-right font-mono text-[11px] tabular-nums text-neutral-400">{p.count}</span>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-neutral-400">No tickets yet.</p>
						{/if}
					</section>

					<!-- Labels -->
					<section class="pub-card ot-rise p-5" style="--rise-i:6">
						<h2 class="pub-label mb-4">Top labels</h2>
						{#if a.byLabel.length}
							<div class="space-y-3">
								{#each a.byLabel as l (l.name)}
									<div class="flex items-center gap-2.5">
										<span class="w-20 shrink-0 truncate text-[13px] text-neutral-500 dark:text-neutral-400" title={l.name}>{l.name}</span>
										<div class="h-2.5 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
											<div class="h-full rounded-full transition-all duration-500" style={`width:${(l.count / labelMax) * 100}%;background:${l.color}`}></div>
										</div>
										<span class="w-7 shrink-0 text-right font-mono text-[11px] tabular-nums text-neutral-400">{l.count}</span>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-neutral-400">No labels used yet.</p>
						{/if}
					</section>
				</div>
			</div>
		{/if}
	</div>
</div>
