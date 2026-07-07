<script lang="ts">
	let { data } = $props();
	const ws = $derived(data.workspace);
	// Fall back to sensible defaults when the workspace hasn't customized its hero.
	const headline = $derived(ws.publicHeadline?.trim() || ws.name);
	const tagline = $derived(
		ws.publicTagline?.trim() ||
			ws.description ||
			"Follow what's being worked on, upvote what matters to you, and suggest what comes next."
	);
</script>

<svelte:head><title>{ws.name}</title></svelte:head>

<main class="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
	<!-- Hero -->
	<section class="mb-14 flex items-start gap-4">
		{#if ws.avatarUrl}
			<img src={ws.avatarUrl} alt="" class="size-12 shrink-0 rounded-xl object-cover" />
		{:else if ws.icon}
			<div class="grid size-12 shrink-0 place-items-center rounded-xl text-2xl" style={`background:${ws.color || 'var(--color-brand-600)'}`}>
				{ws.icon}
			</div>
		{/if}
		<div class="max-w-2xl">
			<h1 class="text-3xl font-bold tracking-tight sm:text-4xl">{headline}</h1>
			<p class="mt-3 text-lg text-neutral-600 dark:text-neutral-300">{tagline}</p>
		</div>
	</section>

	<!-- Projects -->
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.projects as p (p.slug)}
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
		{:else}
			<p class="text-sm text-neutral-400">No public projects here yet.</p>
		{/each}
	</div>
</main>
