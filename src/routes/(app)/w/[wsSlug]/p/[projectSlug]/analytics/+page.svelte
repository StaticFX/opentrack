<script lang="ts">
	import { PRIORITY_META } from '$lib/priority';
	import ProjectPageHeader from '$lib/components/app/ProjectPageHeader.svelte';

	let { data } = $props();
	const a = $derived(data.analytics);

	const weeklyMax = $derived(Math.max(1, ...a.weekly.flatMap((w) => [w.opened, w.closed])));
	const priMax = $derived(Math.max(1, ...a.byPriority.map((p) => p.count)));
	const labelMax = $derived(Math.max(1, ...a.byLabel.map((l) => l.count)));
	const cycle = $derived(a.cycleTimeDays == null ? '—' : `${a.cycleTimeDays.toFixed(1)}d`);

	const stats = $derived([
		{ label: 'Total tickets', value: a.totals.total },
		{ label: 'Open', value: a.totals.open },
		{ label: 'Closed', value: a.totals.closed },
		{ label: 'Avg cycle time', value: cycle }
	]);
</script>

<svelte:head><title>Analytics — {data.project.name}</title></svelte:head>

<div class="flex h-full flex-col">
	<ProjectPageHeader section="Analytics" />
	<div class="min-h-0 flex-1 overflow-y-auto">
		{#if a.totals.total === 0}
			<div class="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
				<div class="rounded-xl border border-dashed border-neutral-300 py-20 text-center dark:border-neutral-700">
					<p class="text-sm text-neutral-400">No ticket data yet.</p>
					<p class="mt-1 text-xs text-neutral-400">Analytics appear once tickets are created and moved.</p>
				</div>
			</div>
		{:else}
		<div class="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
	<!-- Stat cards -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		{#each stats as s (s.label)}
			<div class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
				<div class="text-2xl font-bold tracking-tight">{s.value}</div>
				<div class="mt-0.5 text-xs text-neutral-500">{s.label}</div>
			</div>
		{/each}
	</div>

	<!-- Opened vs closed, weekly -->
	<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-sm font-semibold">Opened vs. closed (last {a.weekly.length} weeks)</h2>
			<div class="flex items-center gap-3 text-xs text-neutral-500">
				<span class="flex items-center gap-1"><span class="size-2.5 rounded-sm bg-brand-500"></span> Opened</span>
				<span class="flex items-center gap-1"><span class="size-2.5 rounded-sm bg-green-500"></span> Closed</span>
			</div>
		</div>
		<div class="flex items-end gap-2" style="height:160px">
			{#each a.weekly as w (w.label)}
				<div class="flex flex-1 flex-col items-center gap-1">
					<div class="flex h-full w-full items-end justify-center gap-1">
						<div class="w-3 rounded-t bg-brand-500 sm:w-4" style={`height:${(w.opened / weeklyMax) * 100}%`} title={`${w.opened} opened`}></div>
						<div class="w-3 rounded-t bg-green-500 sm:w-4" style={`height:${(w.closed / weeklyMax) * 100}%`} title={`${w.closed} closed`}></div>
					</div>
					<span class="text-[10px] text-neutral-400">{w.label}</span>
				</div>
			{/each}
		</div>
	</section>

	<div class="mt-6 grid gap-6 sm:grid-cols-2">
		<!-- Priority -->
		<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
			<h2 class="mb-4 text-sm font-semibold">By priority</h2>
			{#if a.byPriority.length}
				<div class="space-y-2.5">
					{#each a.byPriority as p (p.priority)}
						{@const meta = PRIORITY_META[p.priority as keyof typeof PRIORITY_META]}
						<div class="flex items-center gap-2 text-sm">
							<span class="w-16 shrink-0 text-neutral-500">{meta?.label ?? p.priority}</span>
							<div class="h-4 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
								<div class="h-full rounded" style={`width:${(p.count / priMax) * 100}%;background:${meta?.color ?? '#9ca3af'}`}></div>
							</div>
							<span class="w-6 shrink-0 text-right text-neutral-400">{p.count}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-neutral-400">No tickets yet.</p>
			{/if}
		</section>

		<!-- Labels -->
		<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
			<h2 class="mb-4 text-sm font-semibold">Top labels</h2>
			{#if a.byLabel.length}
				<div class="space-y-2.5">
					{#each a.byLabel as l (l.name)}
						<div class="flex items-center gap-2 text-sm">
							<span class="w-20 shrink-0 truncate text-neutral-500" title={l.name}>{l.name}</span>
							<div class="h-4 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
								<div class="h-full rounded" style={`width:${(l.count / labelMax) * 100}%;background:${l.color}`}></div>
							</div>
							<span class="w-6 shrink-0 text-right text-neutral-400">{l.count}</span>
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
