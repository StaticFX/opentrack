<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { CheckCheck } from '@lucide/svelte';
	import { ago } from '$lib/time';
	import { notificationIcon, notificationTint, notificationHref } from '$lib/notifications';

	let { data } = $props();

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

<div class="mx-auto max-w-2xl px-6 py-8">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-xl font-semibold">Inbox</h1>
			<p class="text-sm text-neutral-500">
				{data.unread > 0 ? `${data.unread} unread` : 'All caught up'}
			</p>
		</div>
		{#if data.unread > 0}
			<button
				type="button"
				onclick={readAll}
				class="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
			>
				<CheckCheck size={15} /> Mark all read
			</button>
		{/if}
	</div>

	<div class="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
		{#each data.items as n (n.id)}
			{@const Icon = notificationIcon(n.type)}
			<a
				href={notificationHref(n)}
				onclick={() => openItem(n.id, n.readAt)}
				class={`flex gap-3 border-b border-neutral-100 px-4 py-3 last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40 ${!n.readAt ? 'bg-brand-50 dark:bg-brand-500/10' : ''}`}
			>
				<Icon size={17} class={`mt-0.5 shrink-0 ${notificationTint(n.type)}`} />
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">{n.title}</p>
					{#if n.body}<p class="truncate text-sm text-neutral-500">{n.body}</p>{/if}
					<p class="mt-0.5 text-xs text-neutral-400">{ago(n.createdAt)}</p>
				</div>
				{#if !n.readAt}<span class="mt-2 size-2 shrink-0 rounded-full bg-brand-600"></span>{/if}
			</a>
		{:else}
			<p class="px-4 py-16 text-center text-sm text-neutral-400">
				No notifications yet. You'll be notified about tickets and suggestions you follow.
			</p>
		{/each}
	</div>
</div>
