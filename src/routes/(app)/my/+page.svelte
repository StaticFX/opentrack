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
		if (d - now < DAY) return { label: 'Due today', cls: 'text-[var(--accent-fg)]' };
		return { label: `Due ${ago(new Date(due))}`.replace('ago', '').trim(), cls: 'text-neutral-500' };
	}
</script>

<svelte:head><title>My Work — OpenTrack</title></svelte:head>

{#snippet ticketRow(t: MyTicket)}
	{@const p = PRIORITY_META[t.priority as Priority]}
	{@const dm = dueMeta(t.dueDate)}
	<a
		href={t.url}
		class="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
	>
		{#if t.priority !== 'none'}
			<span class="size-2 shrink-0 rounded-full" style={`background:${p.color}`} title={p.label}></span>
		{:else}
			<span class="size-2 shrink-0"></span>
		{/if}
		<span class="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">{t.title}</span>
		{#if dm}<span class={`shrink-0 font-mono text-[11px] font-medium ${dm.cls}`}>{dm.label}</span>{/if}
		<span class="flex shrink-0 items-center gap-1.5 text-xs text-neutral-400">
			<span class="size-2 rounded-full" style={`background:${t.projColor ?? '#9ca3af'}`}></span>
			{t.projName} <span class="font-mono">#{t.number}</span>
		</span>
	</a>
{/snippet}

{#snippet section(title: string, icon: typeof Eye, tint: string, items: MyTicket[], empty: string, i: number)}
	{@const Icon = icon}
	<section class="ot-rise mb-8" style={`--rise-i:${i}`}>
		<div class="mb-2.5 flex items-center gap-2">
			<Icon size={16} class={tint} />
			<h2 class="type-poster text-lg">{title}</h2>
			<span class="rounded-full bg-black/5 px-2 py-px font-mono text-[11px] tabular-nums text-neutral-500 dark:bg-white/10 dark:text-neutral-400">{items.length}</span>
		</div>
		<div class="space-y-0.5">
			{#each items as t (t.id)}
				{@render ticketRow(t)}
			{:else}
				<p class="rounded-2xl bg-black/[0.03] px-4 py-6 text-center text-sm text-neutral-400 dark:bg-white/[0.04]">{empty}</p>
			{/each}
		</div>
	</section>
{/snippet}

<div class="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
	<div class="mb-6">
		<h1 class="type-poster text-2xl">My Work</h1>
		<p class="mt-1 text-sm text-neutral-500">Everything across your workspaces that needs you.</p>
	</div>

	{@render section('Due soon', CalendarClock, 'text-[var(--accent-fg)]', data.dueSoon, 'Nothing due in the next week.', 0)}
	{@render section('Assigned to me', CircleUser, 'text-[var(--accent-fg)]', data.assigned, 'No open tickets assigned to you.', 1)}
	{@render section('Watching', Eye, 'text-neutral-400 dark:text-neutral-500', data.watching, "You're not watching any open tickets.", 2)}

	<section class="ot-rise" style="--rise-i:3">
		<div class="mb-2.5 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Bell size={16} class="text-neutral-400 dark:text-neutral-500" />
				<h2 class="type-poster text-lg">Recent notifications</h2>
			</div>
			<a href="/inbox" class="flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-[var(--accent-fg)]">Inbox <ArrowRight size={12} /></a>
		</div>
		<div class="space-y-0.5">
			{#each data.notifications as n (n.id)}
				{@const Icon = notificationIcon(n.type)}
				<a
					href={n.url}
					class={`flex gap-3 rounded-xl px-2.5 py-2 transition-colors ${!n.readAt ? 'bg-[var(--accent-wash)] hover:bg-[var(--accent-soft)]' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'}`}
				>
					<Icon size={16} class={`mt-0.5 shrink-0 ${notificationTint(n.type)}`} />
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm text-neutral-800 dark:text-neutral-100">{n.title}</p>
						{#if n.body}<p class="truncate text-xs text-neutral-500">{n.body}</p>{/if}
					</div>
					<span class="shrink-0 font-mono text-[11px] text-neutral-400">{ago(new Date(n.createdAt))}</span>
				</a>
			{:else}
				<p class="rounded-2xl bg-black/[0.03] px-4 py-6 text-center text-sm text-neutral-400 dark:bg-white/[0.04]">No notifications yet.</p>
			{/each}
		</div>
	</section>
</div>
