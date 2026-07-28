<script lang="ts">
	import { ChevronUp, MessageSquare, Circle, Timer, CircleCheckBig, Map } from '@lucide/svelte';
	import EmptyState from '$lib/components/public/EmptyState.svelte';
	import PublicMeta from '$lib/components/public/PublicMeta.svelte';

	let { data } = $props();

	const base = $derived(`/${data.workspace.slug}/${data.project.slug}`);
	const laneMeta: Record<string, { color: string; icon: typeof Circle; blurb: string }> = {
		planned: { color: '#3b82f6', icon: Circle, blurb: 'On the list' },
		in_progress: { color: '#f59e0b', icon: Timer, blurb: 'Being built now' },
		shipped: { color: '#22c55e', icon: CircleCheckBig, blurb: 'Out in the wild' }
	};
	const total = $derived(data.lanes.reduce((n, l) => n + l.count, 0));
</script>

<PublicMeta
	title={`${data.project.name} roadmap`}
	description={`What's planned, what's being built, and what's shipped for ${data.project.name}.`}
/>

<div class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
	{#if total === 0}
		<div class="pub-card rounded-3xl">
			<EmptyState icon={Map} title="The map is still being drawn" body="Nothing on the roadmap yet — check back soon." />
		</div>
	{:else}
		<!-- Journey bar: planned → in progress → shipped. -->
		<div class="mb-6 flex items-center gap-3">
			<div class="flex h-1.5 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
				{#each data.lanes as lane (lane.key)}
					{#if lane.count}
						<div
							class="h-full"
							style={`width:${(lane.count / total) * 100}%;background:${laneMeta[lane.key].color}`}
							title={`${lane.title}: ${lane.count}`}
						></div>
					{/if}
				{/each}
			</div>
			<span class="shrink-0 font-mono text-[11px] font-medium text-neutral-400">{total} {total === 1 ? 'item' : 'items'}</span>
		</div>

		<div class="grid gap-5 md:grid-cols-3">
			{#each data.lanes as lane, li (lane.key)}
				{@const meta = laneMeta[lane.key]}
				{@const Icon = meta.icon}
				<section class="ot-rise flex flex-col" style={`--rise-i:${li * 2}`}>
					<div
						class="mb-3 flex items-center gap-2.5 rounded-2xl border border-black/5 px-4 py-3 dark:border-white/5"
						style={`background:color-mix(in oklab, ${meta.color} 9%, transparent)`}
					>
						<span class="grid size-8 place-items-center rounded-xl text-white shadow-sm" style={`background:${meta.color}`}>
							<Icon size={16} />
						</span>
						<div class="min-w-0 flex-1">
							<h2 class="font-display text-sm font-bold tracking-tight">{lane.title}</h2>
							<p class="text-[11px] text-neutral-500 dark:text-neutral-400">{meta.blurb}</p>
						</div>
						<span class="rounded-full px-2 py-0.5 font-mono text-xs font-bold" style={`background:color-mix(in oklab, ${meta.color} 15%, transparent);color:${meta.color}`}>{lane.count}</span>
					</div>

					<div class="flex flex-col gap-2.5">
						{#each lane.items as t (t.number)}
							<a
								href={`${base}/t/${t.number}`}
								class="pub-card group p-3.5 transition duration-150 hover:-translate-y-0.5 active:scale-[0.98]"
								style={`view-transition-name: t-${t.number}`}
							>
								<div class="flex items-start gap-2">
									<span class="mt-0.5 font-mono text-xs text-neutral-400">#{t.number}</span>
									<span class="min-w-0 flex-1 text-sm font-medium text-neutral-800 group-hover:text-neutral-950 dark:text-neutral-100 dark:group-hover:text-white">{t.title}</span>
								</div>

								{#if t.labels.length}
									<div class="mt-2 flex flex-wrap gap-1">
										{#each t.labels as l (l.id)}
											<span class="rounded-full px-2 py-0.5 text-[10px] font-medium" style={`background:color-mix(in oklab, ${l.color} 12%, transparent);color:${l.color}`}>{l.name}</span>
										{/each}
									</div>
								{/if}

								<div class="mt-2.5 flex items-center gap-3 font-mono text-xs text-neutral-400">
									{#if t.votes > 0}<span class="flex items-center gap-0.5 font-semibold text-[var(--accent-fg)]"><ChevronUp size={13} /> {t.votes}</span>{/if}
									{#if t.comments}<span class="flex items-center gap-1"><MessageSquare size={12} /> {t.comments}</span>{/if}
								</div>
							</a>
						{:else}
							<p class="rounded-2xl border border-dashed border-neutral-300 px-3 py-8 text-center text-xs text-neutral-400 dark:border-neutral-700">Nothing here yet</p>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}
</div>
