<script lang="ts">
	import { page } from '$app/state';
	import { LayoutGrid, Map, Lightbulb, Tag, GitBranch, ExternalLink } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';

	let { data, children } = $props();

	const base = $derived(`/${data.workspace.slug}/${data.project.slug}`);
	const tabs = $derived([
		{ href: base, label: 'Board', icon: LayoutGrid, match: (p: string) => p === base },
		...(data.project.roadmapEnabled
			? [{ href: `${base}/roadmap`, label: 'Roadmap', icon: Map, match: (p: string) => p.startsWith(`${base}/roadmap`) }]
			: []),
		{ href: `${base}/suggestions`, label: 'Suggestions', icon: Lightbulb, match: (p: string) => p.startsWith(`${base}/suggestions`) },
		...(data.hasReleases
			? [{ href: `${base}/releases`, label: 'Releases', icon: Tag, match: (p: string) => p.startsWith(`${base}/releases`) }]
			: [])
	]);
</script>

<div class="border-b border-neutral-200 dark:border-neutral-800">
	<div class="mx-auto max-w-6xl px-4 sm:px-6">
		<nav class="pt-5 text-sm text-neutral-400">
			<a href="/" class="hover:text-neutral-600">Home</a> /
			<a href={`/${data.workspace.slug}`} class="hover:text-neutral-600">{data.workspace.name}</a>
		</nav>
		<div class="mt-2 flex items-center gap-2.5">
			<span class="size-3.5 rounded-full" style={`background:${data.project.color ?? '#9ca3af'}`}></span>
			<h1 class="text-xl font-bold tracking-tight">{data.project.name}</h1>
		</div>
		{#if data.project.description}<p class="mt-1 text-sm text-neutral-500">{data.project.description}</p>{/if}

		<div class="mt-4 -mb-px flex items-center gap-1 overflow-x-auto">
			{#each tabs as tab (tab.href)}
				{@const active = tab.match(page.url.pathname)}
				<a
					href={tab.href}
					class={cn(
						'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
						active
							? 'border-brand-600 text-neutral-900 dark:text-neutral-100'
							: 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
					)}
				>
					<tab.icon size={15} />
					{tab.label}
				</a>
			{/each}
			{#if data.project.githubRepo}
				<a
					href={`https://github.com/${data.project.githubRepo}`}
					target="_blank"
					rel="noreferrer"
					class="ml-auto flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
				>
					<GitBranch size={15} /> GitHub <ExternalLink size={12} class="text-neutral-400" />
				</a>
			{/if}
		</div>
	</div>
</div>

{@render children()}
