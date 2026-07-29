<script lang="ts" module>
	import {
		notificationIcon,
		notificationTint,
		notificationHref,
		type NotificationItem
	} from '$lib/notifications';

	// One shared feed for every mounted bell (rail row + mobile icon): a single
	// fetch + EventSource, refcounted across instances.
	const feed = $state({ items: [] as NotificationItem[], unread: 0 });
	let refs = 0;
	let es: EventSource | null = null;

	async function refresh() {
		try {
			const res = await fetch('/api/notifications?limit=10');
			if (!res.ok) return;
			const d = await res.json();
			feed.items = d.items;
			feed.unread = d.unread;
		} catch {
			/* offline — leave last known state */
		}
	}

	function acquire() {
		refs += 1;
		if (refs === 1) {
			void refresh();
			try {
				es = new EventSource('/api/sse/notifications');
				es.addEventListener('notification', () => void refresh());
			} catch {
				/* SSE unsupported — the badge still loads on mount */
			}
		}
		return () => {
			refs -= 1;
			if (refs === 0) {
				es?.close();
				es = null;
			}
		};
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { Bell, Check } from '@lucide/svelte';
	import { page } from '$app/state';
	import { clickOutside } from '$lib/utils/clickOutside';
	import { cn } from '$lib/utils/cn';
	import { ago } from '$lib/time';
	import Tooltip from '$lib/components/ui/Tooltip.svelte';
	import { railBarIn, railBarOut, RAIL_BAR_KEY } from './NavRow.svelte';

	type Props = {
		/** 'rail' = Inbox row with popover; 'icon' = mobile top-bar link to /inbox. */
		variant?: 'rail' | 'icon';
		/** Icon-only presentation for the collapsed 56px rail. */
		collapsed?: boolean;
	};
	let { variant = 'rail', collapsed = false }: Props = $props();

	let open = $state(false);
	const unread = $derived(feed.unread);
	const active = $derived(page.url.pathname === '/inbox');
	const unreadLabel = $derived(unread > 99 ? '99+' : String(unread));

	async function markAllRead() {
		feed.unread = 0;
		feed.items = feed.items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }));
		await fetch('/api/notifications/read', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{}'
		});
	}

	async function openItem(n: NotificationItem) {
		open = false;
		if (!n.readAt) {
			feed.unread = Math.max(0, feed.unread - 1);
			n.readAt = new Date().toISOString();
			await fetch('/api/notifications/read', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ids: [n.id] })
			});
		}
	}

	onMount(() => acquire());
</script>

{#if variant === 'icon'}
	<!-- Mobile top bar: badge is visible without opening anything; tap = /inbox. -->
	<a
		href="/inbox"
		class="hit focus-ring relative grid size-9 shrink-0 place-items-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
		aria-label={unread > 0 ? `Inbox — ${unreadLabel} unread` : 'Inbox'}
	>
		<Bell size={18} aria-hidden="true" />
		{#if unread > 0}
			<span
				class="data-mono absolute top-0.5 right-0.5 grid min-w-4 place-items-center rounded-full px-1 py-px font-semibold text-white"
				style="background:var(--accent-solid)">{unreadLabel}</span
			>
		{/if}
	</a>
{:else}
	<div class="relative">
		{#if collapsed}
			<Tooltip label={unread > 0 ? `Inbox · ${unreadLabel} unread` : 'Inbox'} side="right">
				<button
					type="button"
					onclick={() => {
						open = !open;
						if (open) void refresh();
					}}
					aria-label="Inbox"
					aria-haspopup="true"
					aria-expanded={open}
					class={cn(
						'focus-ring hit relative grid size-9 place-items-center rounded-lg transition-colors',
						active ? 'bg-white/10 text-white' : 'text-neutral-300 hover:bg-white/5 hover:text-white'
					)}
				>
					<Bell size={16} aria-hidden="true" />
					{#if unread > 0}
						<span
							aria-hidden="true"
							class="absolute top-1 right-1 size-2 rounded-full"
							style="background:var(--accent-solid)"
						></span>
					{/if}
				</button>
			</Tooltip>
		{:else}
			<button
				type="button"
				onclick={() => {
					open = !open;
					if (open) void refresh();
				}}
				aria-haspopup="true"
				aria-expanded={open}
				class={cn(
					'focus-ring relative flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] transition-colors',
					active ? 'bg-white/10 font-medium text-white' : 'text-neutral-300 hover:bg-white/5 hover:text-white'
				)}
			>
				{#if active}
					<span
						aria-hidden="true"
						class="absolute inset-y-1.5 left-0 w-0.5"
						style="background:var(--accent)"
						in:railBarIn={{ key: RAIL_BAR_KEY }}
						out:railBarOut={{ key: RAIL_BAR_KEY }}
					></span>
				{/if}
				<Bell size={15} class={active ? 'text-neutral-200' : 'text-neutral-400'} aria-hidden="true" />
				<span class="min-w-0 flex-1 truncate">Inbox</span>
				{#if unread > 0}
					<span
						class="data-mono grid min-w-4 shrink-0 place-items-center rounded-full px-1.5 py-px font-semibold text-white"
						style="background:var(--accent-solid)">{unreadLabel}</span
					>
				{/if}
			</button>
		{/if}

		{#if open}
			<div
				use:clickOutside={() => (open = false)}
				class="absolute top-full left-0 z-30 mt-1 max-h-[70vh] w-80 overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-900 shadow-xl dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
			>
				<div class="flex items-center justify-between border-b border-neutral-100 px-3 py-2 dark:border-neutral-800">
					<span class="text-[13px] font-medium">Notifications</span>
					{#if unread > 0}
						<button
							type="button"
							onclick={markAllRead}
							class="focus-ring flex items-center gap-1 rounded text-xs text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
						>
							<Check size={12} aria-hidden="true" /> Mark all read
						</button>
					{/if}
				</div>

				<div class="max-h-[60vh] overflow-y-auto">
					{#each feed.items as n (n.id)}
						{@const Icon = notificationIcon(n.type)}
						<a
							href={notificationHref(n)}
							onclick={() => openItem(n)}
							class={cn(
								'flex gap-2.5 border-b border-neutral-50 px-3 py-2.5 transition-colors hover:bg-neutral-50 dark:border-neutral-800/60 dark:hover:bg-neutral-800/50',
								!n.readAt && 'bg-[var(--accent-wash)]'
							)}
						>
							<Icon size={15} class={cn('mt-0.5 shrink-0', notificationTint(n.type))} />
							<div class="min-w-0 flex-1">
								<p class="truncate text-[13px] font-medium">{n.title}</p>
								{#if n.body}<p class="truncate text-xs text-neutral-500 dark:text-neutral-400">{n.body}</p>{/if}
								<p class="data-mono mt-0.5 text-neutral-500 dark:text-neutral-400">{ago(n.createdAt)}</p>
							</div>
							{#if !n.readAt}
								<span
									class="mt-1.5 size-2 shrink-0 rounded-full"
									style="background:var(--accent-solid)"
									aria-hidden="true"
								></span>
							{/if}
						</a>
					{:else}
						<p class="px-3 py-8 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
							You're all caught up.
						</p>
					{/each}
				</div>

				<a
					href="/inbox"
					onclick={() => (open = false)}
					class="block border-t border-neutral-100 px-3 py-2 text-center text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-800 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200"
				>
					View all
				</a>
			</div>
		{/if}
	</div>
{/if}
