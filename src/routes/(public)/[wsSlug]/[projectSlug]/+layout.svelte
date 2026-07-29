<script lang="ts">
	import { page } from '$app/state';
	import {
		Activity,
		SquareKanban,
		Map,
		MessagesSquare,
		Tag,
		GitBranch,
		ChevronRight,
		Ellipsis,
		Rss,
		Search
	} from '@lucide/svelte';
	import { liveInvalidate } from '$lib/client/live';
	import PublicCommandPalette from '$lib/components/public/PublicCommandPalette.svelte';
	import DropdownMenu from '$lib/components/ui/DropdownMenu.svelte';
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

	// GitHub + both RSS feeds fold into one overflow pill so they survive on
	// mobile instead of being `hidden sm:flex`-ed away entirely.
	const overflowItems = $derived([
		...(data.project.githubRepo
			? [{ label: data.project.githubRepo, icon: GitBranch, href: `https://github.com/${data.project.githubRepo}` }]
			: []),
		{ label: 'Feedback RSS', icon: Rss, href: `${base}/suggestions/rss.xml` },
		...(data.hasReleases ? [{ label: 'Releases RSS', icon: Rss, href: `${base}/releases/rss.xml` }] : [])
	]);

	const openPalette = () => window.dispatchEvent(new CustomEvent('pub-palette'));

	// Band scoreboard: one mono live fragment + breathing dot, ticking off the
	// same board SSE stream the board/overview pages already subscribe to —
	// so the "is this alive" signal persists across every tab, not just Overview.
	let beat = $state(0);
	const liveBoardId = $derived(data.boardId);
	const liveProjectId = $derived(data.project.id);
	$effect(() => {
		if (!liveBoardId) return;
		const stop = liveInvalidate(`/api/sse/board/${liveBoardId}`, `public:band:${liveProjectId}`, {
			debounce: 1500,
			maxWait: 5000,
			onEvent: () => beat++
		});
		return () => stop();
	});
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

<div class="accent-scope" style="--accent:#3b5bff">
	<PublicCommandPalette
		projectId={data.project.id}
		{base}
		projectName={data.project.name}
		tabs={tabs.map((t) => ({ href: t.href, label: t.label }))}
	/>

	<!-- Identity band — type on the ground, present on every project page. Named so
	     tab switches don't crossfade it with the root (identical snapshots are
	     seamless; only the page content below fades). -->
	<div class="relative" style="view-transition-name: project-band">
		<div class="mx-auto max-w-6xl px-4 pt-6 pb-5 sm:px-6">
			<nav class="flex items-center gap-1.5 text-[11px] tracking-tight text-[var(--faint)]">
				<a href="/" class="mono-focus transition-colors hover:text-[var(--accent)]">Home</a>
				<ChevronRight size={11} />
				<a href={`/${data.workspace.slug}`} class="mono-focus transition-colors hover:text-[var(--accent)]"
					>{data.workspace.name}</a
				>
			</nav>

			<div class="mt-4 flex flex-wrap items-center gap-4">
				<span
					class="mono-display grid size-12 shrink-0 place-items-center rounded-sm border border-[var(--rule)] bg-[var(--raised)] text-lg text-[var(--text)]"
					style="view-transition-name: project-mark"
				>
					{#if data.project.icon}{data.project.icon}{:else}{data.project.name.slice(0, 1).toUpperCase()}{/if}
				</span>
				<div class="min-w-0">
					<h1 class="mono-display text-3xl tracking-tight text-[var(--text)] sm:text-4xl">{data.project.name}</h1>
					{#if data.project.description}
						<p class="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--dim)]">{data.project.description}</p>
					{/if}
				</div>
				<!-- Live scoreboard — one mono fragment + breathing dot, wired to the
				     board SSE stream so "is this alive" persists across every tab. -->
				<span
					class="ml-auto flex shrink-0 items-center gap-2 text-[12px] tracking-tight tabular-nums text-[var(--faint)]"
				>
					<span class="relative flex size-1.5" aria-hidden="true">
						{#if beat > 0}<span class="ot-breathe absolute inline-flex size-full rounded-full bg-[var(--accent)] opacity-60"></span>{/if}
						<span class="relative inline-flex size-1.5 rounded-full bg-[var(--accent)]"></span>
					</span>
					<span class="text-[var(--accent)]">{data.stats.open}</span> open
					<span aria-hidden="true">·</span>
					<span class="text-[var(--green)]">{data.stats.shipped}</span> shipped
				</span>
			</div>
		</div>
	</div>

	<!-- Tab nav — a hairline-underlined mono row, sticky under the site header.
	     Named for the same reason as the band: the bar itself must not blink
	     during tab switches (the active tab keeps its own pub-tab-pill morph). -->
	<div
		class="sticky top-14 z-20 border-b border-[var(--rule)] bg-[color-mix(in_srgb,var(--ground)_88%,transparent)] backdrop-blur-md"
		style="view-transition-name: project-tabs"
	>
		<div class="mx-auto max-w-6xl px-4 sm:px-6">
			<div class="flex items-center gap-4">
				<nav
					class="mono-scroll -mb-px flex min-w-0 flex-1 items-center gap-6 overflow-x-auto"
					aria-label="Project sections"
					style="scrollbar-width: none"
				>
					{#each tabs as tab (tab.href)}
						{@const active = tab.match(page.url.pathname)}
						<a
							href={tab.href}
							aria-current={active ? 'page' : undefined}
							class={cn(
								'mono-focus relative shrink-0 py-3.5 text-[13px] tracking-tight whitespace-nowrap transition-colors',
								active ? 'text-[var(--text)]' : 'text-[var(--dim)] hover:text-[var(--text)]'
							)}
						>
							{tab.label}
							{#if active}
								<span
									class="absolute inset-x-0 -bottom-px h-[2px] bg-[var(--accent)]"
									style="view-transition-name: pub-tab-pill"
								></span>
							{/if}
						</a>
					{/each}
				</nav>

				{#if overflowItems.length}
					<DropdownMenu items={overflowItems} placement="bottom-end" ariaLabel="Project links">
						{#snippet trigger(tp)}
							<button
								type="button"
								{...tp}
								class="mono-focus flex shrink-0 items-center justify-center border border-[var(--rule)] p-2 text-[var(--dim)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
								aria-label="More links"
							>
								<Ellipsis size={15} />
							</button>
						{/snippet}
					</DropdownMenu>
				{/if}

				<button
					type="button"
					onclick={openPalette}
					class="mono-focus flex shrink-0 items-center gap-1.5 border border-[var(--rule)] px-2.5 py-2 text-[12px] tracking-tight text-[var(--dim)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
					aria-label="Search this project"
				>
					<Search size={14} />
					<kbd class="hidden font-mono text-[10px] text-[var(--faint)] sm:inline">⌘K</kbd>
				</button>
			</div>
		</div>
	</div>

	<!-- The one spine well every project tab shares — reading pages (releases,
	     suggestion/ticket detail) center a narrower column inside it, so the
	     content boundary never jumps switching tabs. -->
	<div class="mx-auto w-full max-w-6xl">
		{@render children()}
	</div>
</div>
