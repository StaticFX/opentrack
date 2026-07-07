<script lang="ts">
	import { ChevronUp, MessageSquare, Circle, Timer, CircleCheckBig } from '@lucide/svelte';

	let { data } = $props();

	const base = $derived(`/${data.workspace.slug}/${data.project.slug}`);
	const laneMeta: Record<string, { color: string; icon: typeof Circle }> = {
		planned: { color: '#3b82f6', icon: Circle },
		in_progress: { color: '#f59e0b', icon: Timer },
		shipped: { color: '#22c55e', icon: CircleCheckBig }
	};
	const total = $derived(data.lanes.reduce((n, l) => n + l.count, 0));
</script>

<svelte:head><title>Roadmap — {data.project.name}</title></svelte:head>

<div class="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
	{#if total === 0}
		<p class="py-20 text-center text-sm text-neutral-400">Nothing on the roadmap yet — check back soon.</p>
	{:else}
		<div class="grid gap-5 md:grid-cols-3">
			{#each data.lanes as lane (lane.key)}
				{@const meta = laneMeta[lane.key]}
				<section class="flex flex-col">
					<div class="mb-3 flex items-center gap-2">
						<meta.icon size={16} style={`color:${meta.color}`} />
						<h2 class="text-sm font-semibold tracking-tight">{lane.title}</h2>
						<span class="text-xs text-neutral-400">{lane.count}</span>
					</div>

					<div class="flex flex-col gap-2.5">
						{#each lane.items as t (t.number)}
							<a
								href={`${base}/t/${t.number}`}
								class="group rounded-xl border border-neutral-200 bg-white p-3.5 transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:border-neutral-700"
							>
								<div class="flex items-start gap-2">
									<span class="mt-0.5 font-mono text-xs text-neutral-400">#{t.number}</span>
									<span class="min-w-0 flex-1 text-sm font-medium text-neutral-800 group-hover:text-neutral-950 dark:text-neutral-100 dark:group-hover:text-white">{t.title}</span>
								</div>

								{#if t.labels.length}
									<div class="mt-2 flex flex-wrap gap-1">
										{#each t.labels as l (l.id)}
											<span class="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={`background:${l.color}22;color:${l.color}`}>{l.name}</span>
										{/each}
									</div>
								{/if}

								<div class="mt-2.5 flex items-center gap-3 text-xs text-neutral-400">
									<span class="flex items-center gap-1"><ChevronUp size={13} /> {t.votes}</span>
									{#if t.comments}<span class="flex items-center gap-1"><MessageSquare size={12} /> {t.comments}</span>{/if}
								</div>
							</a>
						{:else}
							<p class="rounded-xl border border-dashed border-neutral-200 px-3 py-6 text-center text-xs text-neutral-400 dark:border-neutral-800">Nothing here yet.</p>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}
</div>
