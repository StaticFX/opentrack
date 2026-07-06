<script lang="ts">
	import { CircleUser, Eye, CalendarClock, Bell, ArrowRight } from '@lucide/svelte';
	import { ago } from '$lib/time';
	import { PRIORITY_META } from '$lib/priority';
	import { notificationIcon, notificationTint } from '$lib/notifications';
	import type { Priority } from '$lib/constants';
	import type { MyTicket } from '$lib/server/services/mywork';

	let { data } = $props();

	const DAY = 86_400_000;
	function dueMeta(due: Date | string | null) {
		if (!due) return null;
		const d = new Date(due).getTime();
		const now = Date.now();
		if (d < now) return { label: 'Overdue', cls: 'text-red-600 dark:text-red-400' };
		if (d - now < DAY) return { label: 'Due today', cls: 'text-orange-600 dark:text-orange-400' };
		return { label: `Due ${ago(new Date(due))}`.replace('ago', '').trim(), cls: 'text-neutral-500' };
	}
</script>

<svelte:head><title>My Work — OpenTrack</title></svelte:head>

{#snippet ticketRow(t: MyTicket)}
	{@const p = PRIORITY_META[t.priority as Priority]}
	{@const dm = dueMeta(t.dueDate)}
	<a
		href={t.url}
		class="flex items-center gap-3 border-b border-neutral-100 px-4 py-2.5 last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40"
	>
		{#if t.priority !== 'none'}
			<span class="size-2 shrink-0 rounded-full" style={`background:${p.color}`} title={p.label}></span>
		{:else}
			<span class="size-2 shrink-0"></span>
		{/if}
		<span class="min-w-0 flex-1 truncate text-sm text-neutral-800 dark:text-neutral-100">{t.title}</span>
		{#if dm}<span class={`shrink-0 text-xs ${dm.cls}`}>{dm.label}</span>{/if}
		<span class="flex shrink-0 items-center gap-1 text-xs text-neutral-400">
			<span class="size-2 rounded-full" style={`background:${t.projColor ?? '#9ca3af'}`}></span>
			{t.projName} · #{t.number}
		</span>
	</a>
{/snippet}

{#snippet section(title: string, icon: typeof Eye, tint: string, items: MyTicket[], empty: string)}
	{@const Icon = icon}
	<section class="mb-6">
		<div class="mb-2 flex items-center gap-2">
			<Icon size={16} class={tint} />
			<h2 class="text-sm font-semibold">{title}</h2>
			<span class="rounded-full bg-neutral-100 px-1.5 text-xs text-neutral-500 dark:bg-neutral-800">{items.length}</span>
		</div>
		<div class="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
			{#each items as t (t.id)}
				{@render ticketRow(t)}
			{:else}
				<p class="px-4 py-6 text-center text-sm text-neutral-400">{empty}</p>
			{/each}
		</div>
	</section>
{/snippet}

<div class="mx-auto max-w-3xl px-6 py-8">
	<div class="mb-6">
		<h1 class="text-xl font-semibold">My Work</h1>
		<p class="text-sm text-neutral-500">Everything across your workspaces that needs you.</p>
	</div>

	{@render section('Due soon', CalendarClock, 'text-orange-500', data.dueSoon, 'Nothing due in the next week.')}
	{@render section('Assigned to me', CircleUser, 'text-brand-500', data.assigned, 'No open tickets assigned to you.')}
	{@render section('Watching', Eye, 'text-neutral-500', data.watching, "You're not watching any open tickets.")}

	<section>
		<div class="mb-2 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Bell size={16} class="text-neutral-500" />
				<h2 class="text-sm font-semibold">Recent notifications</h2>
			</div>
			<a href="/inbox" class="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">Inbox <ArrowRight size={12} /></a>
		</div>
		<div class="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
			{#each data.notifications as n (n.id)}
				{@const Icon = notificationIcon(n.type)}
				<a
					href={n.url}
					class={`flex gap-3 border-b border-neutral-100 px-4 py-2.5 last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40 ${!n.readAt ? 'bg-brand-50 dark:bg-brand-500/10' : ''}`}
				>
					<Icon size={16} class={`mt-0.5 shrink-0 ${notificationTint(n.type)}`} />
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm text-neutral-800 dark:text-neutral-100">{n.title}</p>
						{#if n.body}<p class="truncate text-xs text-neutral-500">{n.body}</p>{/if}
					</div>
					<span class="shrink-0 text-xs text-neutral-400">{ago(new Date(n.createdAt))}</span>
				</a>
			{:else}
				<p class="px-4 py-6 text-center text-sm text-neutral-400">No notifications yet.</p>
			{/each}
		</div>
	</section>
</div>
