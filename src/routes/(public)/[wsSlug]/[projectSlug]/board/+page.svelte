<script lang="ts">
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { ChevronUp, Radio, Telescope } from '@lucide/svelte';
	import { announce } from '$lib/announce';
	import { liveInvalidate } from '$lib/client/live';
	import ColumnIcon from '$lib/components/board/ColumnIcon.svelte';
	import EmptyState from '$lib/components/public/EmptyState.svelte';
	import PublicMeta from '$lib/components/public/PublicMeta.svelte';
	import PublicTicketCard from '$lib/components/public/PublicTicketCard.svelte';

	let { data } = $props();

	const base = $derived(`/${data.workspace.slug}/${data.project.slug}`);
	const ticketUrl = (n: number) => `${base}/t/${n}`;
	const total = $derived(data.columns.reduce((n, c) => n + c.tickets.length, 0));

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

{#if total === 0}
	<div class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
		<div class="pub-card rounded-3xl">
			<EmptyState
				icon={Telescope}
				title="Nothing on the board yet"
				body="But the front door is open — ideas and bug reports shape what gets built first."
			/>
		</div>
	</div>
{:else}
	<div class="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
		<div class="flex items-center gap-3">
			<!-- Distribution bar: how the work is spread across the columns. -->
			<div class="flex h-1.5 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
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
			<span class="flex shrink-0 items-center gap-2 font-mono text-[11px] font-medium text-neutral-400">
				{#if live}<span class="flex items-center gap-1 text-[var(--accent-fg)]" title="Live — updates as they happen"><Radio size={11} /> live</span>{/if}
				{total} {total === 1 ? 'item' : 'items'}
			</span>
		</div>

		<!-- Ticker: one line narrating what just happened. -->
		<div class="relative mt-1 h-6 overflow-hidden" aria-hidden="true">
			{#each ticker.slice(-1) as m (m.id)}
				<p
					class="absolute inset-x-0 truncate font-mono text-[11px] text-[var(--accent-fg)]"
					in:fly={{ y: 8, duration: motionOK() ? 200 : 0 }}
					out:fly={{ y: -8, duration: motionOK() ? 200 : 0 }}
				>
					{m.text}
				</p>
			{/each}
		</div>
	</div>

	<div class="overflow-x-auto px-4 pb-6 sm:px-6" style="scrollbar-width: thin">
		<div class="mx-auto flex w-max snap-x snap-mandatory items-start gap-4">
			{#each data.columns as col, i (col.id)}
				<section class="ot-rise w-[82vw] max-w-76 shrink-0 snap-start sm:w-76" style={`--rise-i:${i * 2}`}>
					<div class="mb-2.5 flex items-center gap-2 px-1">
						<ColumnIcon icon={col.icon} color={col.color} />
						<span class="font-display text-sm font-semibold tracking-tight">{col.name}</span>
						<span
							class="rounded-full px-1.5 py-px font-mono text-[11px] font-semibold"
							style={`background:color-mix(in oklab, ${col.color} 13%, transparent);color:${col.color}`}
						>{col.tickets.length}</span>
					</div>
					<div
						class="space-y-2.5 rounded-2xl border border-black/5 bg-white/45 p-2.5 dark:border-white/5 dark:bg-white/[0.04]"
					>
						{#each col.tickets as t (t.id)}
							<div animate:flip={{ duration: motionOK() ? 300 : 0, easing: cubicOut }}>
								<PublicTicketCard ticket={t} href={ticketUrl(t.number)} edge={col.color} flash={flashId === t.id} />
							</div>
						{:else}
							<p class="px-1 py-8 text-center text-xs text-neutral-400">Nothing here yet</p>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	</div>

	{#if !data.signedIn}
		<p class="mx-auto max-w-6xl px-4 pb-4 text-center font-mono text-[11px] text-neutral-400 sm:px-6">
			<ChevronUp size={11} class="inline" /> vote on any ticket — no account needed
		</p>
	{/if}
{/if}
