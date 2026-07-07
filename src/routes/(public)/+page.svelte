<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.site.name} — {data.site.headline}</title></svelte:head>

<main class="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
	<section class="mb-14 max-w-2xl">
		<h1 class="text-3xl font-bold tracking-tight sm:text-4xl">{data.site.headline}</h1>
		<p class="mt-3 text-lg text-neutral-600 dark:text-neutral-300">{data.site.tagline}</p>
	</section>

	{#if data.items.length}
		<div class="space-y-10">
			{#each data.items as ws (ws.slug)}
				<section>
					<a href={`/${ws.slug}`} class="group inline-flex items-center gap-2">
						<h2 class="text-lg font-semibold tracking-tight">{ws.name}</h2>
						<ArrowRight size={16} class="text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500" />
					</a>
					{#if ws.description}<p class="mt-0.5 text-sm text-neutral-500">{ws.description}</p>{/if}
					<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#each ws.projects as p (p.slug)}
							<a
								href={`/${ws.slug}/${p.slug}`}
								class="rounded-xl border border-neutral-200 p-4 transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
							>
								<div class="flex items-center gap-2">
									<span class="size-3 rounded-full" style={`background:${p.color ?? '#9ca3af'}`}></span>
									<span class="font-medium">{p.name}</span>
								</div>
								{#if p.description}<p class="mt-1.5 line-clamp-2 text-sm text-neutral-500">{p.description}</p>{/if}
							</a>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{:else}
		<div class="rounded-xl border border-dashed border-neutral-300 py-20 text-center dark:border-neutral-700">
			<p class="text-sm text-neutral-500">No public projects yet — check back soon.</p>
		</div>
	{/if}
</main>
