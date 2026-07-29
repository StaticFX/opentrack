<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { CheckCheck } from '@lucide/svelte';
	import ViewHeader from '$lib/components/app/ViewHeader.svelte';
	import Tabs, { type TabItem } from '$lib/components/ui/Tabs.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import TimeAgo from '$lib/components/ui/TimeAgo.svelte';
	import EmptyStateApp from '$lib/components/ui/EmptyStateApp.svelte';
	import { notificationIcon, notificationTint, notificationHref } from '$lib/notifications';
	import { cn } from '$lib/utils/cn';

	let { data } = $props();

	let tab = $state<'unread' | 'all'>('all');
	const tabItems: TabItem[] = $derived([
		{ key: 'unread', label: 'Unread', count: data.unread },
		{ key: 'all', label: 'All', count: data.items.length }
	]);
	const shown = $derived(tab === 'unread' ? data.items.filter((n) => !n.readAt) : data.items);

	// Notification `url`s are public deep links `/{wsSlug}/{projSlug}/...` — the
	// project slug (there's no project-name field on the notification row) is
	// enough for a source chip without a loader change.
	function projectChip(url: string): string | null {
		const m = url.match(/^\/([^/]+)\/([^/]+)\//);
		return m ? m[2] : null;
	}

	function dayKey(d: string | Date): string {
		const x = new Date(d);
		return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
	}
	function dayLabel(d: string | Date): string {
		const x = new Date(d);
		const now = new Date();
		const startOf = (v: Date) => new Date(v.getFullYear(), v.getMonth(), v.getDate()).getTime();
		const diff = Math.round((startOf(now) - startOf(x)) / 86_400_000);
		if (diff === 0) return 'Today';
		if (diff === 1) return 'Yesterday';
		if (diff < 7) return x.toLocaleDateString(undefined, { weekday: 'long' });
		return x.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	async function readAll() {
		await fetch('/api/notifications/read', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{}'
		});
		await invalidateAll();
	}

	async function openItem(id: string, readAt: Date | string | null) {
		if (readAt) return;
		await fetch('/api/notifications/read', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ids: [id] })
		});
	}
</script>

<svelte:head><title>Inbox — OpenTrack</title></svelte:head>

<ViewHeader crumbs={[{ label: 'Inbox' }]}>
	{#snippet toolbar()}
		<Tabs items={tabItems} bind:value={tab} ariaLabel="Notification filter" />
	{/snippet}
	{#snippet actions()}
		{#if data.unread > 0}
			<Button size="sm" onclick={readAll}><CheckCheck size={14} aria-hidden="true" /> Mark all read</Button>
		{/if}
	{/snippet}
</ViewHeader>

<div class="view-4xl">
	{#if shown.length === 0}
		<EmptyStateApp
			icon={CheckCheck}
			title={tab === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
			body={tab === 'all' ? "You'll be notified about tickets and suggestions you follow." : undefined}
		/>
	{:else}
		<div class="flex flex-col border-t border-[var(--rule)]">
			{#each shown as n, i (n.id)}
				{@const Icon = notificationIcon(n.type)}
				{@const proj = projectChip(n.url)}
				{@const divider = i === 0 || dayKey(n.createdAt) !== dayKey(shown[i - 1].createdAt) ? dayLabel(n.createdAt) : null}
				{#if divider}
					<!-- Sticky under the h-12 ViewHeader; static below lg, where the
					     header itself un-sticks per the mobile chrome budget. -->
					<div class="divider-scan sticky top-0 z-10 bg-[var(--ground)] py-1.5 lg:top-12">{divider}</div>
				{/if}
				<a
					href={notificationHref(n)}
					onclick={() => openItem(n.id, n.readAt)}
					class={cn(
						'mono-focus flex items-start gap-3 border-b border-b-[var(--rule)] border-l-2 py-2.5 pl-2.5 text-[13px] transition-colors duration-200 motion-reduce:transition-none',
						!n.readAt ? 'border-l-[var(--accent)]' : 'border-l-transparent'
					)}
				>
					<Icon size={16} class={cn('mt-0.5 shrink-0', notificationTint(n.type))} aria-hidden="true" />
					<div class="min-w-0 flex-1">
						<p class={cn('truncate', n.readAt ? 'text-[var(--dim)]' : 'font-medium text-[var(--text)]')}>{n.title}</p>
						<div class="mt-1 flex min-w-0 items-center gap-1.5">
							{#if proj}<Badge tone="neutral">{proj}</Badge>{/if}
							{#if n.body}<span class="truncate text-[var(--faint)]">{n.body}</span>{/if}
						</div>
					</div>
					<span class="flex shrink-0 items-center gap-2">
						<TimeAgo date={n.createdAt} />
						{#if !n.readAt}<span class="size-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true"></span>{/if}
					</span>
				</a>
			{/each}
		</div>
	{/if}
</div>
