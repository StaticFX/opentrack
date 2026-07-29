<script lang="ts">
	import { ExternalLink, LayoutGrid, Plus } from '@lucide/svelte';
	import ViewHeader, { type Crumb } from '$lib/components/app/ViewHeader.svelte';
	import StatTile from '$lib/components/app/StatTile.svelte';
	import ActivityFeed from '$lib/components/app/ActivityFeed.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import AvatarStack from '$lib/components/ui/AvatarStack.svelte';
	import { PROJECT_NAV } from '$lib/projectNav';

	let { data } = $props();

	const wsSlug = $derived(data.workspace.slug);
	const projSlug = $derived(data.project.slug);
	const base = $derived(`/w/${wsSlug}/p/${projSlug}`);
	const firstBoard = $derived(data.boards[0]);
	const boardHref = $derived(firstBoard ? `${base}/b/${firstBoard.id}` : base);
	const canManage = $derived(data.canManageProject);

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
			label: 'Overview',
			menu: [
				...data.boards.map((b) => ({ label: b.name, href: `${base}/b/${b.id}` })),
				...PROJECT_NAV.filter((i) => !i.external && (!i.manageOnly || canManage)).map((i) => ({
					label: i.label,
					href: i.href(wsSlug, projSlug),
					current: i.key === 'overview'
				}))
			]
		}
	]);
</script>

<svelte:head><title>Overview · {data.project.name} · OpenTrack</title></svelte:head>

<ViewHeader {crumbs} live={{ text: `${data.stats.openTickets} open` }} tabs>
	{#snippet actions()}
		{#if firstBoard}
			<Button variant="accent" size="sm" href={boardHref}><LayoutGrid size={14} /> Open board</Button>
		{/if}
	{/snippet}
</ViewHeader>

<div class="view-5xl">
	{#if data.project.description}
		<p class="mb-6 max-w-2xl text-[13px] text-[var(--dim)]">{data.project.description}</p>
	{:else if canManage}
		<p class="mb-6 text-[13px] text-[var(--faint)] italic">
			No description yet. <a href={`${base}/settings`} class="not-italic font-medium text-[var(--accent-fg)] hover:underline">Add one →</a>
		</p>
	{/if}

	<!-- Stat policy: max 3 linked tiles per page, each with a 7-day trend. -->
	<div class="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
		<StatTile
			label="Open"
			value={data.stats.openTickets}
			href={boardHref}
			spark={data.openSpark}
			accent={data.project.color ?? undefined}
			class={canManage ? undefined : 'sm:col-span-3'}
		/>
		{#if canManage}
			<StatTile
				label="Triage"
				value={data.inboxOpenCount}
				href={`${base}/inbox`}
				spark={data.triageSpark}
				accent={data.project.color ?? undefined}
			/>
			<StatTile
				label="Releases"
				value={data.stats.releases}
				href={`${base}/releases`}
				spark={data.releaseSpark}
				accent={data.project.color ?? undefined}
			/>
		{/if}
	</div>

	<div class="grid gap-8 lg:grid-cols-[1fr_20rem]">
		<!-- Boards: a persistent chip row, stable even with a single board. -->
		<section class="min-w-0">
			<h3 class="mb-3 text-[11px] font-medium tracking-[0.18em] text-[var(--faint)] uppercase">// Boards</h3>
			{#if data.boards.length}
				<div class="flex flex-wrap gap-2">
					{#each data.boards as b (b.id)}
						<a
							href={`${base}/b/${b.id}`}
							class="hairline focus-ring inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-[var(--dim)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
							><LayoutGrid size={12} class="text-[var(--faint)]" /> {b.name}</a
						>
					{/each}
				</div>
			{:else}
				<p class="text-[13px] text-[var(--faint)]">No boards yet.</p>
			{/if}
		</section>

		<!-- Collaborators + public link + activity -->
		<aside class="space-y-8">
			<section>
				<h3 class="mb-3 text-[11px] font-medium tracking-[0.18em] text-[var(--faint)] uppercase">// Collaborators</h3>
				{#if data.members.length}
					<AvatarStack users={data.members.map((m) => ({ name: m.displayName, src: m.avatarUrl }))} max={8} size={24} />
				{:else}
					<p class="text-[13px] text-[var(--faint)]">No collaborators yet.</p>
				{/if}
				{#if canManage}
					<a
						href={`${base}/settings`}
						class="focus-ring mt-3 inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-[var(--dim)] hover:text-[var(--text)]"
						><Plus size={13} /> Manage collaborators</a
					>
				{/if}
			</section>

			<section class="border-t border-[var(--rule)] pt-6">
				<h3 class="mb-3 text-[11px] font-medium tracking-[0.18em] text-[var(--faint)] uppercase">// Public page</h3>
				<a
					href={`/${wsSlug}/${projSlug}`}
					target="_blank"
					rel="noreferrer"
					class="focus-ring flex items-center gap-2 rounded-lg text-[13px] text-[var(--dim)] hover:text-[var(--accent)]"
					><ExternalLink size={14} class="text-[var(--faint)]" /> View public page</a
				>
			</section>

			<section class="border-t border-[var(--rule)] pt-6">
				<div class="mb-3 flex items-baseline justify-between gap-3">
					<h3 class="text-[11px] font-medium tracking-[0.18em] text-[var(--faint)] uppercase">// Activity</h3>
					{#if data.activity.length}
						<a href={`${base}/activity`} class="focus-ring rounded-md text-[11px] font-medium text-[var(--faint)] hover:text-[var(--accent-fg)]">view all</a>
					{/if}
				</div>
				<ActivityFeed items={data.activity} {wsSlug} projectSlug={projSlug} dense emptyText="No activity yet." />
			</section>
		</aside>
	</div>
</div>
