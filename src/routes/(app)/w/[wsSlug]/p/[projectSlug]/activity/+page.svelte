<script lang="ts">
	import ViewHeader, { type Crumb } from '$lib/components/app/ViewHeader.svelte';
	import ActivityFeed from '$lib/components/app/ActivityFeed.svelte';
	import Tabs, { type TabItem } from '$lib/components/ui/Tabs.svelte';
	import { PROJECT_NAV } from '$lib/projectNav';

	let { data } = $props();

	const wsSlug = $derived(data.workspace.slug);
	const projSlug = $derived(data.project.slug);
	const base = $derived(`/w/${wsSlug}/p/${projSlug}`);

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
			label: 'Activity',
			menu: [
				...data.boards.map((b) => ({ label: b.name, href: `${base}/b/${b.id}` })),
				...PROJECT_NAV.filter((i) => !i.external && (!i.manageOnly || data.canManageProject)).map((i) => ({
					label: i.label,
					href: i.href(wsSlug, projSlug),
					current: i.key === 'activity'
				}))
			]
		}
	]);

	let typeFilter = $state('all');
	const typeItems: TabItem[] = [
		{ key: 'all', label: 'All' },
		{ key: 'ticket', label: 'Tickets' },
		{ key: 'suggestion', label: 'Feedback' },
		{ key: 'release', label: 'Releases' }
	];
	const filtered = $derived(
		typeFilter === 'all' ? data.activity : data.activity.filter((a) => a.subjectType === typeFilter)
	);
	const nextLimit = $derived(data.limit + 50);
</script>

<svelte:head><title>Activity · {data.project.name} · OpenTrack</title></svelte:head>

<ViewHeader {crumbs} live={{ text: `${data.activity.length} events` }} tabs />

<div class="view-5xl">
	<div class="mx-auto max-w-2xl">
		<div class="mb-4">
			<Tabs items={typeItems} bind:value={typeFilter} ariaLabel="Filter activity by type" />
		</div>

		<ActivityFeed items={filtered} {wsSlug} projectSlug={projSlug} emptyText="No activity matches." />

		{#if data.hasMore}
			<div class="mt-6 flex justify-center border-t border-[var(--rule)] pt-6">
				<a
					href={`?limit=${nextLimit}`}
					class="mono-focus inline-flex h-8 items-center border border-[var(--rule)] px-3 text-[13px] text-[var(--dim)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
					>Load more</a
				>
			</div>
		{/if}
	</div>
</div>
