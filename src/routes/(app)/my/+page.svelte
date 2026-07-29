<script lang="ts">
	import { CircleUser, Eye, CalendarClock, Bell } from '@lucide/svelte';
	import ViewHeader from '$lib/components/app/ViewHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import EmptyStateApp from '$lib/components/ui/EmptyStateApp.svelte';
	import { dueMeta } from '$lib/time';
	import { PRIORITY_META } from '$lib/priority';
	import { cn } from '$lib/utils/cn';
	import type { Priority } from '$lib/constants';
	import type { MyTicket } from '$lib/server/services/mywork';

	let { data } = $props();

	// Client-side only — the loader already scopes each list to the user;
	// these two just reshape/filter what's already on the page.
	let groupByProject = $state(false);
	let showClosed = $state(false);

	function visible(items: MyTicket[]): MyTicket[] {
		return showClosed ? items : items.filter((t) => !t.closed);
	}
	function byProject(items: MyTicket[]) {
		const groups = new Map<string, { projName: string; projColor: string | null; items: MyTicket[] }>();
		for (const t of items) {
			const g = groups.get(t.projSlug) ?? { projName: t.projName, projColor: t.projColor, items: [] };
			g.items.push(t);
			groups.set(t.projSlug, g);
		}
		return [...groups.values()].sort((a, b) => a.projName.localeCompare(b.projName));
	}
</script>

<svelte:head><title>My Work — OpenTrack</title></svelte:head>

{#snippet ticketRow(t: MyTicket)}
	{@const p = PRIORITY_META[t.priority as Priority]}
	{@const dm = dueMeta(t.dueDate)}
	<li class="border-b border-[var(--rule)]">
		<a href={t.url} class="mono-focus group flex h-9 items-center gap-3 text-[13px] transition-colors">
			{#if t.priority !== 'none'}
				<span class="size-2 shrink-0 rounded-full" style={`background:${p.color}`} title={p.label} aria-hidden="true"></span>
			{:else}
				<span class="size-2 shrink-0" aria-hidden="true"></span>
			{/if}
			<span class="min-w-0 flex-1 truncate text-[var(--text)] group-hover:text-[var(--accent)]">{t.title}</span>
			{#if dm}
				<span
					class={cn(
						'data-mono shrink-0',
						dm.overdue ? 'text-[#f85149]' : dm.soon ? 'text-[var(--amber)]' : 'text-[var(--faint)]'
					)}>{dm.label}</span
				>
			{/if}
			<span class="flex shrink-0 items-center gap-1.5 text-[var(--faint)]">
				<span class="size-1.5 rounded-full" style={`background:${t.projColor ?? 'var(--faint)'}`} aria-hidden="true"></span>
				<span class="data-mono hidden sm:inline">{t.projName}</span> <span class="data-mono">#{t.number}</span>
			</span>
		</a>
	</li>
{/snippet}

{#snippet section(title: string, icon: typeof Eye, tint: string, items: MyTicket[], empty: string)}
	{@const Icon = icon}
	{@const shown = visible(items)}
	<section class="border-t border-[var(--rule)] pt-8">
		<div class="mb-3 flex items-center gap-2">
			<Icon size={13} class={tint} aria-hidden="true" />
			<p class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// {title}</p>
			<span class="data-mono text-[var(--faint)]">{shown.length}</span>
		</div>
		{#if shown.length === 0}
			<EmptyStateApp icon={Icon} title={empty} compact />
		{:else if groupByProject}
			<div class="space-y-5">
				{#each byProject(shown) as g (g.projName)}
					<div>
						<div class="mb-1 flex items-center gap-1.5">
							<span class="size-1.5 rounded-full" style={`background:${g.projColor ?? 'var(--faint)'}`} aria-hidden="true"></span>
							<span class="data-mono text-[var(--faint)]">{g.projName}</span>
						</div>
						<ul class="border-t border-[var(--rule)]">
							{#each g.items as t (t.id)}
								{@render ticketRow(t)}
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		{:else}
			<ul class="border-t border-[var(--rule)]">
				{#each shown as t (t.id)}
					{@render ticketRow(t)}
				{/each}
			</ul>
		{/if}
	</section>
{/snippet}

<ViewHeader crumbs={[{ label: 'My Work' }]}>
	{#snippet toolbar()}
		<div class="flex items-center gap-4">
			<Switch bind:checked={groupByProject} label="Group by project" />
			<Switch bind:checked={showClosed} label="Show closed" />
		</div>
	{/snippet}
	{#snippet actions()}
		<Button size="sm" variant="ghost" href="/inbox"><Bell size={14} aria-hidden="true" /> Inbox</Button>
	{/snippet}
</ViewHeader>

<div class="view-4xl">
	{@render section('Due soon', CalendarClock, 'text-[var(--accent)]', data.dueSoon, 'Nothing due in the next week.')}
	{@render section('Assigned to me', CircleUser, 'text-[var(--accent)]', data.assigned, 'No open tickets assigned to you.')}
	{@render section('Watching', Eye, 'text-[var(--faint)]', data.watching, "You're not watching any open tickets.")}
</div>
