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

<div class="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
	<div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="type-poster text-2xl">Inbox</h1>
			<p class="mt-1 text-sm text-neutral-500">
				{#if data.unread > 0}<span class="font-mono tabular-nums text-[var(--accent-fg)]">{data.unread}</span> unread{:else}All caught up{/if}
			</p>
		</div>
		{#if data.unread > 0}
			<button
				type="button"
				onclick={readAll}
				class="flex items-center gap-1.5 self-start rounded-lg border border-black/5 bg-white px-2.5 py-1.5 text-sm font-medium text-neutral-600 shadow-sm transition-colors hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700/70"
			>
				<CheckCheck size={15} /> Mark all read
			</button>
		{/if}
	</div>

	<div class="space-y-0.5">
		{#each data.items as n, i (n.id)}
			{@const Icon = notificationIcon(n.type)}
			<a
				href={notificationHref(n)}
				onclick={() => openItem(n.id, n.readAt)}
				class={`ot-rise flex gap-3 rounded-xl px-3 py-2.5 transition-colors ${!n.readAt ? 'bg-[var(--accent-wash)] hover:bg-[var(--accent-soft)]' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'}`}
				style={`--rise-i:${i}`}
			>
				<Icon size={17} class={`mt-0.5 shrink-0 ${notificationTint(n.type)}`} />
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">{n.title}</p>
					{#if n.body}<p class="truncate text-sm text-neutral-500">{n.body}</p>{/if}
					<p class="mt-0.5 font-mono text-[11px] text-neutral-400">{ago(n.createdAt)}</p>
				</div>
				{#if !n.readAt}<span class="mt-2 size-2 shrink-0 rounded-full" style="background:var(--accent)"></span>{/if}
			</a>
		{:else}
			<p class="rounded-2xl bg-black/[0.03] px-4 py-16 text-center text-sm text-neutral-400 dark:bg-white/[0.04]">
				No notifications yet. You'll be notified about tickets and suggestions you follow.
			</p>
		{/each}
	</div>
</div>
