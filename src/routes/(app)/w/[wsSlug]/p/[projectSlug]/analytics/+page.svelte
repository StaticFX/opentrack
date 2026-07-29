<script lang="ts">
	import { PRIORITY_META } from '$lib/priority';
	import ViewHeader, { type Crumb } from '$lib/components/app/ViewHeader.svelte';
	import StatTile from '$lib/components/app/StatTile.svelte';
	import { PROJECT_NAV } from '$lib/projectNav';

	let { data } = $props();
	const a = $derived(data.analytics);

	const wsSlug = $derived(data.workspace.slug);
	const projSlug = $derived(data.project.slug);
	const base = $derived(`/w/${wsSlug}/p/${projSlug}`);
	const firstBoard = $derived(data.boards[0]);
	const boardHref = $derived(firstBoard ? `${base}/b/${firstBoard.id}` : base);

	const crumbs = $derived<Crumb[]>([
		{
			label: data.project.name,
			href: base,
			dot: data.project.color ?? undefined,
			menu:
				(data.projects?.length ?? 0) > 1
					? data.projects.map((p) => ({ label: p.name, href: `/w/${wsSlug}/p/${p.slug}`, current: p.slug === projSlug }))
					: undefined
		},
		{
			label: 'Analytics',
			menu: [
				...data.boards.map((b) => ({ label: b.name, href: `${base}/b/${b.id}` })),
				...PROJECT_NAV.filter((i) => !i.external && (!i.manageOnly || data.canManageProject)).map((i) => ({
					label: i.label,
					href: i.href(wsSlug, projSlug),
					current: i.key === 'analytics'
				}))
			]
		}
	]);

	const weeklyMax = $derived(Math.max(1, ...a.weekly.flatMap((w) => [w.opened, w.closed])));
	const priMax = $derived(Math.max(1, ...a.byPriority.map((p) => p.count)));
	const labelMax = $derived(Math.max(1, ...a.byLabel.map((l) => l.count)));
	const cycle = $derived(a.cycleTimeDays == null ? '—' : `${a.cycleTimeDays.toFixed(1)}d`);
	const openSpark = $derived(a.weekly.map((w) => w.opened));

	// Mono chart palette: escalating attention, not a rainbow. Priority bars
	// read severity through the same four tokens every chart on this page uses.
	const priorityColor: Record<string, string> = {
		none: 'var(--dim)',
		low: 'var(--dim)',
		medium: 'var(--dim)',
		high: 'var(--amber)',
		urgent: 'var(--accent)'
	};
</script>

<svelte:head><title>Analytics · {data.project.name} · OpenTrack</title></svelte:head>

<ViewHeader {crumbs} tabs />

<div class="view-5xl">
	{#if a.totals.total === 0}
		<div class="texture-dots border border-[var(--rule)] py-20 text-center">
			<p class="text-[13px] text-[var(--dim)]">No ticket data yet.</p>
			<p class="data-mono mt-1 text-[var(--faint)]">Analytics appear once tickets are created and moved.</p>
		</div>
	{:else}
		<!-- Stat policy: one linked tile (Open); the rest are inline mono fragments. -->
		<div class="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
			<StatTile label="Open" value={a.totals.open} href={boardHref} spark={openSpark} accent={data.project.color ?? undefined} />
			<div class="hairline flex items-center gap-6 rounded-[4px] px-4 py-3 sm:col-span-2">
				<div>
					<p class="mono-display text-xl leading-none text-[var(--text)]">{a.totals.total}</p>
					<p class="mt-1 text-[11px] tracking-wide text-[var(--dim)] uppercase">Total tickets</p>
				</div>
				<div>
					<p class="mono-display text-xl leading-none text-[var(--text)]">{a.totals.closed}</p>
					<p class="mt-1 text-[11px] tracking-wide text-[var(--dim)] uppercase">Closed</p>
				</div>
				<div>
					<p class="mono-display text-xl leading-none text-[var(--text)]">{cycle}</p>
					<p class="mt-1 text-[11px] tracking-wide text-[var(--dim)] uppercase">Avg cycle time</p>
				</div>
			</div>
		</div>

		<!-- Opened vs closed, weekly -->
		<section class="border-t border-[var(--rule)] pt-6">
			<div class="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<p class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Opened vs. closed</p>
				<div class="data-mono flex items-center gap-3 text-[var(--dim)]">
					<span class="flex items-center gap-1.5"><span class="size-2.5" style="background:var(--accent)"></span> opened</span>
					<span class="flex items-center gap-1.5"><span class="size-2.5" style="background:var(--green)"></span> closed</span>
				</div>
			</div>
			<div class="flex items-end gap-2 pt-4" style="height:160px">
				{#each a.weekly as w (w.label)}
					<div class="flex flex-1 flex-col items-center gap-1 self-stretch">
						<div class="flex h-full w-full items-end justify-center gap-1">
							<div class="relative w-3 sm:w-4" style={`height:${(w.opened / weeklyMax) * 100}%;background:var(--accent)`}>
								{#if w.opened > 0}
									<span class="data-mono absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] whitespace-nowrap text-[var(--dim)]">{w.opened}</span>
								{/if}
							</div>
							<div class="relative w-3 sm:w-4" style={`height:${(w.closed / weeklyMax) * 100}%;background:var(--green)`}>
								{#if w.closed > 0}
									<span class="data-mono absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] whitespace-nowrap text-[var(--dim)]">{w.closed}</span>
								{/if}
							</div>
						</div>
						<span class="data-mono text-[var(--faint)]">{w.label}</span>
					</div>
				{/each}
			</div>
			<p class="mt-3 text-[11px] text-[var(--faint)]">Weekly ticket volume, oldest to newest — last {a.weekly.length} weeks.</p>
		</section>

		<div class="mt-8 grid gap-8 border-t border-[var(--rule)] pt-6 sm:grid-cols-2">
			<!-- Priority -->
			<section>
				<p class="mb-4 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// By priority</p>
				{#if a.byPriority.length}
					<div class="space-y-3">
						{#each a.byPriority as p (p.priority)}
							{@const meta = PRIORITY_META[p.priority as keyof typeof PRIORITY_META]}
							<div class="flex items-center gap-2.5">
								<span class="w-16 shrink-0 text-[13px] text-[var(--dim)]">{meta?.label ?? p.priority}</span>
								<div class="h-1.5 flex-1 bg-[var(--rule)]">
									<div class="h-full transition-all duration-500" style={`width:${(p.count / priMax) * 100}%;background:${priorityColor[p.priority] ?? 'var(--dim)'}`}></div>
								</div>
								<span class="data-mono w-7 shrink-0 text-right text-[var(--faint)]">{p.count}</span>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-[13px] text-[var(--faint)]">No tickets yet.</p>
				{/if}
			</section>

			<!-- Labels -->
			<section>
				<p class="mb-4 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Top labels</p>
				{#if a.byLabel.length}
					<div class="space-y-3">
						{#each a.byLabel as l, i (l.name)}
							<div class="flex items-center gap-2.5">
								<span class="w-20 shrink-0 truncate text-[13px] text-[var(--dim)]" title={l.name}>{l.name}</span>
								<div class="h-1.5 flex-1 bg-[var(--rule)]">
									<div class="h-full transition-all duration-500" style={`width:${(l.count / labelMax) * 100}%;background:${i === 0 ? 'var(--accent)' : 'var(--dim)'}`}></div>
								</div>
								<span class="data-mono w-7 shrink-0 text-right text-[var(--faint)]">{l.count}</span>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-[13px] text-[var(--faint)]">No labels used yet.</p>
				{/if}
			</section>
		</div>
	{/if}
</div>
