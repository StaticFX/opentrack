<script lang="ts">
	import { onMount } from 'svelte';
	import { Bell, Check } from '@lucide/svelte';
	import { clickOutside } from '$lib/utils/clickOutside';
	import { ago } from '$lib/time';
	import { notificationIcon, notificationTint, type NotificationItem } from '$lib/notifications';

	let open = $state(false);
	let items = $state<NotificationItem[]>([]);
	let unread = $state(0);

	async function refresh() {
		try {
			const res = await fetch('/api/notifications?limit=10');
			if (!res.ok) return;
			const d = await res.json();
			items = d.items;
			unread = d.unread;
		} catch {
			/* offline — leave last known state */
		}
	}

	async function markAllRead() {
		unread = 0;
		items = items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }));
		await fetch('/api/notifications/read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
	}

	async function openItem(n: NotificationItem) {
		if (!n.readAt) {
			unread = Math.max(0, unread - 1);
			n.readAt = new Date().toISOString();
			await fetch('/api/notifications/read', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ids: [n.id] })
			});
		}
	}

	onMount(() => {
		void refresh();
		let es: EventSource | null = null;
		try {
			es = new EventSource('/api/sse/notifications');
			es.addEventListener('notification', () => void refresh());
		} catch {
			/* SSE unsupported — the badge still loads on mount */
		}
		return () => es?.close();
	});
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => { open = !open; if (open) void refresh(); }}
		class="relative flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-neutral-600 hover:bg-neutral-200/60 dark:text-neutral-300 dark:hover:bg-neutral-800"
		aria-label="Notifications"
	>
		<Bell size={15} class="text-neutral-400" />
		<span class="min-w-0 flex-1 truncate">Inbox</span>
		{#if unread > 0}
			<span class="grid min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
				{unread > 99 ? '99+' : unread}
			</span>
		{/if}
	</button>

	{#if open}
		<div
			use:clickOutside={() => (open = false)}
			class="absolute top-full left-0 z-30 mt-1 max-h-[70vh] w-80 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
		>
			<div class="flex items-center justify-between border-b border-neutral-100 px-3 py-2 dark:border-neutral-800">
				<span class="text-sm font-semibold">Notifications</span>
				{#if unread > 0}
					<button
						type="button"
						onclick={markAllRead}
						class="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
					>
						<Check size={12} /> Mark all read
					</button>
				{/if}
			</div>

			<div class="max-h-[60vh] overflow-y-auto">
				{#each items as n (n.id)}
					{@const Icon = notificationIcon(n.type)}
					<a
						href={n.url}
						onclick={() => openItem(n)}
						class={`flex gap-2.5 border-b border-neutral-50 px-3 py-2.5 hover:bg-neutral-50 dark:border-neutral-800/60 dark:hover:bg-neutral-800/50 ${!n.readAt ? 'bg-brand-50 dark:bg-brand-500/10' : ''}`}
					>
						<Icon size={15} class={`mt-0.5 shrink-0 ${notificationTint(n.type)}`} />
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">{n.title}</p>
							{#if n.body}<p class="truncate text-xs text-neutral-500">{n.body}</p>{/if}
							<p class="mt-0.5 text-[11px] text-neutral-400">{ago(n.createdAt)}</p>
						</div>
						{#if !n.readAt}<span class="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600"></span>{/if}
					</a>
				{:else}
					<p class="px-3 py-8 text-center text-sm text-neutral-400">You're all caught up.</p>
				{/each}
			</div>

			<a
				href="/inbox"
				onclick={() => (open = false)}
				class="block border-t border-neutral-100 px-3 py-2 text-center text-xs font-medium text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800 dark:border-neutral-800 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200"
			>
				View all
			</a>
		</div>
	{/if}
</div>
