<script lang="ts">
	import { page } from '$app/state';
	import {
		Activity,
		SquareKanban,
		Map,
		MessagesSquare,
		Tag,
		GitBranch,
		ExternalLink,
		ChevronRight,
		Search
	} from '@lucide/svelte';
	import PublicCommandPalette from '$lib/components/public/PublicCommandPalette.svelte';
	import { cn } from '$lib/utils/cn';

	let { data, children } = $props();

	const base = $derived(`/${data.workspace.slug}/${data.project.slug}`);
	const tabs = $derived([
		{ href: base, label: 'Overview', icon: Activity, match: (p: string) => p === base },
		{
			href: `${base}/board`,
			label: 'Board',
			icon: SquareKanban,
			match: (p: string) => p.startsWith(`${base}/board`) || p.startsWith(`${base}/t/`)
		},
		...(data.project.roadmapEnabled
			? [{ href: `${base}/roadmap`, label: 'Roadmap', icon: Map, match: (p: string) => p.startsWith(`${base}/roadmap`) }]
			: []),
		{ href: `${base}/suggestions`, label: 'Feedback', icon: MessagesSquare, match: (p: string) => p.startsWith(`${base}/suggestions`) },
		...(data.hasReleases
			? [{ href: `${base}/releases`, label: 'Releases', icon: Tag, match: (p: string) => p.startsWith(`${base}/releases`) }]
			: [])
	]);

	const openPalette = () => window.dispatchEvent(new CustomEvent('pub-palette'));
</script>

<svelte:head>
	<link
		rel="alternate"
		type="application/rss+xml"
		title={`${data.project.name} feedback`}
		href={`${base}/suggestions/rss.xml`}
	/>
	{#if data.hasReleases}
		<link
			rel="alternate"
			type="application/rss+xml"
			title={`${data.project.name} releases`}
			href={`${base}/releases/rss.xml`}
		/>
	{/if}
</svelte:head>

<div class="accent-scope" style={`--accent:${data.project.color || 'var(--color-brand-600)'}`}>
	<PublicCommandPalette
		projectId={data.project.id}
		{base}
		projectName={data.project.name}
		tabs={tabs.map((t) => ({ href: t.href, label: t.label }))}
	/>

	<!-- Identity band — accent-washed, present on every project page. -->
	<div
		class="relative overflow-hidden"
		style="background:
			radial-gradient(760px 300px at 10% -50%, var(--accent-soft), transparent 70%),
			radial-gradient(900px 340px at 90% -65%, var(--accent-wash), transparent 70%)"
	>
		<div class="mx-auto max-w-6xl px-4 pt-5 pb-4 sm:px-6">
			<nav class="flex items-center gap-1 text-xs font-medium text-neutral-400 dark:text-neutral-500">
				<a href="/" class="transition-colors hover:text-neutral-700 dark:hover:text-neutral-300">Home</a>
				<ChevronRight size={12} />
				<a href={`/${data.workspace.slug}`} class="transition-colors hover:text-neutral-700 dark:hover:text-neutral-300">{data.workspace.name}</a>
			</nav>

			<div class="mt-3.5 flex flex-wrap items-center gap-4">
				<span
					class="grid size-13 shrink-0 place-items-center rounded-2xl text-2xl font-bold text-white shadow-lg"
					style="background:linear-gradient(140deg, color-mix(in oklab, var(--accent) 86%, white), var(--accent)); view-transition-name: project-mark"
				>
					{#if data.project.icon}{data.project.icon}{:else}{data.project.name.slice(0, 1).toUpperCase()}{/if}
				</span>
				<div class="min-w-0">
					<h1 class="type-poster text-3xl sm:text-4xl">{data.project.name}</h1>
					{#if data.project.description}
						<p class="mt-0.5 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">{data.project.description}</p>
					{/if}
				</div>
				{#if data.project.githubRepo}
					<a
						href={`https://github.com/${data.project.githubRepo}`}
						target="_blank"
						rel="noreferrer"
						class="ml-auto hidden items-center gap-1.5 rounded-full border border-black/10 bg-white/60 px-3.5 py-1.5 font-mono text-xs text-neutral-600 backdrop-blur transition-colors hover:bg-white sm:flex dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
					>
						<GitBranch size={13} /> {data.project.githubRepo} <ExternalLink size={11} class="text-neutral-400" />
					</a>
				{/if}
			</div>
		</div>
	</div>

	<!-- Floating pill tab bar, sticky under the site header. -->
	<div class="sticky top-14 z-20 pb-1">
		<div class="mx-auto max-w-6xl px-4 sm:px-6">
			<div class="flex items-center gap-2">
				<div
					class="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-black/5 bg-white/80 p-1 backdrop-blur-md dark:border-white/5 dark:bg-neutral-800/80"
					style="box-shadow:var(--ot-shadow-float); scrollbar-width: none"
				>
					{#each tabs as tab (tab.href)}
						{@const active = tab.match(page.url.pathname)}
						<a
							href={tab.href}
							aria-current={active ? 'page' : undefined}
							class={cn(
								'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
								active
									? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
									: 'text-neutral-500 hover:bg-black/5 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white'
							)}
							style={active ? 'view-transition-name: pub-tab-pill' : ''}
						>
							<tab.icon size={15} />
							{tab.label}
						</a>
					{/each}
				</div>

				<button
					type="button"
					onclick={openPalette}
					class="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-black/5 bg-white/80 px-3 py-2 text-sm text-neutral-400 backdrop-blur-md transition-colors hover:text-neutral-700 dark:border-white/5 dark:bg-neutral-800/80 dark:text-neutral-500 dark:hover:text-neutral-200"
					style="box-shadow:var(--ot-shadow-float)"
					aria-label="Search this project"
				>
					<Search size={15} />
					<kbd class="hidden rounded border border-black/10 px-1 font-mono text-[10px] sm:inline dark:border-white/15">⌘K</kbd>
				</button>
			</div>
		</div>
	</div>

	{@render children()}
</div>
