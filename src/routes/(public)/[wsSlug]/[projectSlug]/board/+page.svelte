<script lang="ts">
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { ChevronDown, ChevronUp, Telescope } from '@lucide/svelte';
	import { announce } from '$lib/announce';
	import { liveInvalidate } from '$lib/client/live';
	import ColumnIcon from '$lib/components/board/ColumnIcon.svelte';
	import EmptyState from '$lib/components/public/EmptyState.svelte';
	import PublicMeta from '$lib/components/public/PublicMeta.svelte';
	import PublicTicketCard from '$lib/components/public/PublicTicketCard.svelte';
	import GradualBlur from '$lib/components/vendor/GradualBlur.svelte';

	let { data } = $props();

	const base = $derived(`/${data.workspace.slug}/${data.project.slug}`);
	const ticketUrl = (n: number) => `${base}/t/${n}`;
	const total = $derived(data.columns.reduce((n, c) => n + c.tickets.length, 0));

	// Columns fold to a handful of cards by default — a long Backlog must never
	// push the page taller than ~70vh; "Show all" reveals the rest inside the
	// same capped, internally-scrolling well.
	const INITIAL_COUNT = 6;
	let expandedIds = $state<string[]>([]);
	const isExpanded = (id: string) => expandedIds.includes(id);
	function toggleExpand(id: string) {
		expandedIds = isExpanded(id) ? expandedIds.filter((x) => x !== id) : [...expandedIds, id];
	}

	const motionOK = () =>
		typeof matchMedia !== 'undefined' && !matchMedia('(prefers-reduced-motion: reduce)').matches;

	// ---- Live layer -------------------------------------------------------
	let flashId = $state<string | null>(null);
	let ticker = $state<Array<{ id: number; text: string }>>([]);
	let tickerId = 0;
	let live = $state(false);
	const timers = new Set<ReturnType<typeof setTimeout>>();
	const later = (fn: () => void, ms: number) => {
		const t = setTimeout(() => {
			timers.delete(t);
			fn();
		}, ms);
		timers.add(t);
	};

	const findTicket = (id: unknown) =>
		data.columns.flatMap((c) => c.tickets).find((t) => t.id === id);

	function onEvent(type: string, d: Record<string, unknown>) {
		live = true;
		// Only narrate tickets we can see — board events also fire for private
		// tickets, which must not surface even as a generic line.
		const t = findTicket(d.ticketId);
		if (!t) return;
		let text: string | null = null;
		if (type === 'ticket.voted') {
			text = `▲ #${t.number} “${t.title}” just got a vote`;
			if (motionOK()) {
				flashId = t.id;
				later(() => (flashId = null), 950);
			}
		} else if (type === 'ticket.moved') text = `#${t.number} is on the move`;
		else if (type === 'ticket.commented') text = `New comment on #${t.number}`;
		if (text) {
			const entry = { id: ++tickerId, text };
			ticker = [...ticker.slice(-2), entry];
			announce(text);
			later(() => (ticker = ticker.filter((m) => m.id !== entry.id)), 4000);
		}
	}

	// Depend on the VALUE of boardId (a $derived memoizes by value) — reading
	// data.boardId directly would tear down + reopen the EventSource on every
	// invalidate that the SSE events themselves trigger.
	const liveBoardId = $derived(data.boardId);
	$effect(() => {
		if (!liveBoardId) return;
		const stop = liveInvalidate(`/api/sse/board/${liveBoardId}`, `board:${liveBoardId}`, {
			debounce: 300,
			onEvent
		});
		return () => {
			stop();
			for (const t of timers) clearTimeout(t);
			timers.clear();
		};
	});
</script>

<PublicMeta
	title={`${data.project.name} — live board`}
	description={`${total} items on the wall. Watch ${data.project.name} being built in the open.`}
/>

<main>
	{#if total === 0}
		<div class="px-4 py-14 sm:px-6">
			<EmptyState
				icon={Telescope}
				title="Nothing on the board yet"
				body="But the front door is open — ideas and bug reports shape what gets built first."
			/>
		</div>
	{:else}
		<div class="px-4 pt-6 pb-10 sm:px-6">
			<!-- The board panel — the one bordered "document" on this page; every
			     other public section stays type-on-ground. -->
			<figure class="m-0 overflow-hidden border border-[var(--rule)] bg-[var(--raised)]">
				<figcaption class="border-b border-[var(--rule)] px-3.5 py-3">
					<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
						<!-- Distribution bar: how the work is spread across the columns. -->
						<div class="flex h-1.5 min-w-24 flex-1 overflow-hidden bg-[var(--rule)]">
							{#each data.columns as col (col.id)}
								{#if col.tickets.length}
									<div
										class="h-full transition-all duration-500"
										style={`width:${(col.tickets.length / total) * 100}%;background:${col.color}`}
										title={`${col.name}: ${col.tickets.length}`}
									></div>
								{/if}
							{/each}
						</div>
						<span class="flex shrink-0 items-center gap-3 text-[11px] tabular-nums text-[var(--faint)]">
							{#if live}
								<span class="flex items-center gap-1.5" title="Live — updates as they happen">
									<span class="live-dot is-live inline-block size-1.5 rounded-full" aria-hidden="true"></span>
									<span class="text-[var(--accent)]">live</span>
								</span>
							{/if}
							<span>{total} {total === 1 ? 'item' : 'items'}</span>
						</span>
					</div>

					<!-- Per-column counts, spelled out — the color bar alone only decodes on hover. -->
					<div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
						{#each data.columns as col (col.id)}
							{#if col.tickets.length}
								<span class="flex items-center gap-1.5 text-[11px] tabular-nums text-[var(--faint)]">
									<span class="size-1.5 shrink-0 rounded-full" style={`background:${col.color}`}></span>
									{col.name} {col.tickets.length}
								</span>
							{/if}
						{/each}
					</div>
				</figcaption>

				<!-- Ticker: one line narrating what just happened. -->
				<div class="relative h-6 overflow-hidden border-b border-[var(--rule)] px-3.5" aria-hidden="true">
					{#each ticker.slice(-1) as m (m.id)}
						<p
							class="live-line absolute inset-x-0 flex h-6 items-center truncate px-3.5 text-[11px] text-[var(--accent)]"
							in:fly={{ y: 8, duration: motionOK() ? 200 : 0 }}
							out:fly={{ y: -8, duration: motionOK() ? 200 : 0 }}
						>
							<span class="mr-1.5 text-[var(--faint)]">&gt;</span>{m.text}
						</p>
					{/each}
				</div>

				<div class="relative">
					<div class="mono-scroll overflow-x-auto" style="scrollbar-width: thin">
						<div class="flex w-max snap-x snap-mandatory items-start lg:snap-none">
							{#each data.columns as col (col.id)}
								{@const visible = isExpanded(col.id) ? col.tickets : col.tickets.slice(0, INITIAL_COUNT)}
								{@const hidden = col.tickets.length - visible.length}
								<section class="w-[82vw] max-w-76 shrink-0 snap-start border-r border-[var(--rule)] last:border-r-0 sm:w-76 lg:snap-align-none">
									<header class="flex items-center gap-2 px-3.5 py-2.5">
										<ColumnIcon icon={col.icon} color={col.color} />
										<span class="min-w-0 flex-1 truncate text-[12px] tracking-wide text-[var(--text)] uppercase">{col.name}</span>
										<span class="shrink-0 text-[11px] tabular-nums text-[var(--faint)]">
											{col.tickets.length.toString().padStart(2, '0')}
										</span>
									</header>
									<div class="relative">
										<!-- Capped so a long Backlog scrolls internally — the page never
										     grows taller than ~70vh regardless of column depth. -->
										<div class="mono-scroll max-h-[70vh] overflow-y-auto pb-1">
											{#each visible as t (t.id)}
												<div animate:flip={{ duration: motionOK() ? 300 : 0, easing: cubicOut }}>
													<PublicTicketCard ticket={t} href={ticketUrl(t.number)} edge={col.color} flash={flashId === t.id} />
												</div>
											{:else}
												<p class="px-3.5 py-8 text-center text-[11px] text-[var(--faint)]">Nothing here yet</p>
											{/each}
											{#if col.tickets.length > INITIAL_COUNT}
												<button
													type="button"
													onclick={() => toggleExpand(col.id)}
													class="mono-focus flex w-full items-center justify-center gap-1 border-t border-[var(--rule)] py-2 text-[11px] tracking-tight text-[var(--faint)] transition-colors hover:text-[var(--accent)]"
												>
													{#if hidden > 0}
														Show all {col.tickets.length} <ChevronDown size={12} />
													{:else}
														Show fewer <ChevronUp size={12} />
													{/if}
												</button>
											{/if}
										</div>
										{#if hidden > 0}<GradualBlur side="bottom" size={36} />{/if}
									</div>
								</section>
							{/each}
						</div>
					</div>
					<GradualBlur side="right" size={48} class="hidden sm:block" />
				</div>
			</figure>
		</div>

		{#if !data.signedIn}
			<p class="px-4 pb-10 text-center text-[11px] text-[var(--faint)] sm:px-6">
				<ChevronUp size={11} class="inline" /> vote on any ticket — no account needed
			</p>
		{/if}
	{/if}
</main>

<style>
	.live-dot {
		background: var(--faint);
	}
	.live-dot.is-live {
		background: var(--accent);
	}

	@media (prefers-reduced-motion: no-preference) {
		.live-dot.is-live {
			animation: mono-pulse 1.9s ease-in-out infinite;
		}
		.live-line {
			animation: mono-slide 0.24s ease-out;
		}
	}

	@keyframes mono-pulse {
		0%,
		100% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 55%, transparent);
		}
		50% {
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 0%, transparent);
		}
	}
	@keyframes mono-slide {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
</style>
