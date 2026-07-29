<!--
	MonoBoard — the REAL public kanban board of the showcase project, rendered as
	the ONE bordered panel on this page (a terminal-style document panel; every
	other section is type on the ground). Columns are labeled mono sections; each
	ticket is a monospace row `#{number}  {title}` with its real label(s) and a
	status glyph in the column's real colour. Live over SSE via liveInvalidate keyed
	on `board:<id>` — the loader `depends()` on the same key, so rows refresh in
	place as work moves. No mock cards.
-->
<script lang="ts">
	import type { TicketCard } from '$lib/board';
	import { liveInvalidate } from '$lib/client/live';
	import { announce } from '$lib/announce';

	type Column = { id: string; name: string; color: string; icon: string | null; tickets: TicketCard[] };
	type Props = {
		columns: Column[];
		boardId: string;
		base: string;
		wsSlug: string;
		slug: string;
		ticketTotal: number;
	};
	let { columns, boardId, base, wsSlug, slug, ticketTotal }: Props = $props();

	const CAP = 7;
	const total = $derived(columns.reduce((n, c) => n + c.tickets.length, 0));

	const motionOK = () =>
		typeof matchMedia !== 'undefined' && !matchMedia('(prefers-reduced-motion: reduce)').matches;

	// ---- Live layer (mirrors the board route's wiring) --------------------
	let connected = $state(false);
	let flashId = $state<string | null>(null);
	let liveLine = $state<string | null>(null);
	const timers = new Set<ReturnType<typeof setTimeout>>();
	const later = (fn: () => void, ms: number) => {
		const t = setTimeout(() => {
			timers.delete(t);
			fn();
		}, ms);
		timers.add(t);
	};

	const findTicket = (id: unknown) => columns.flatMap((c) => c.tickets).find((t) => t.id === id);

	function onEvent(type: string, d: Record<string, unknown>) {
		// Only narrate tickets we can actually see — board events fire for private
		// tickets too, which must never surface here.
		const t = findTicket(d.ticketId);
		if (!t) return;
		let text: string | null = null;
		if (type === 'ticket.voted') {
			text = `#${t.number} just got a vote`;
			if (motionOK()) {
				flashId = t.id;
				later(() => (flashId = null), 950);
			}
		} else if (type === 'ticket.moved') text = `#${t.number} moved`;
		else if (type === 'ticket.created') text = `#${t.number} opened`;
		else if (type === 'ticket.commented') text = `new comment on #${t.number}`;
		if (text) {
			liveLine = text;
			announce(text);
			const mine = text;
			later(() => {
				if (liveLine === mine) liveLine = null;
			}, 4000);
		}
	}

	const liveBoardId = $derived(boardId);
	$effect(() => {
		if (!liveBoardId) return;
		const stop = liveInvalidate(`/api/sse/board/${liveBoardId}`, `board:${liveBoardId}`, {
			debounce: 300,
			onEvent
		});
		connected = true;
		return () => {
			stop();
			connected = false;
			for (const t of timers) clearTimeout(t);
			timers.clear();
		};
	});
</script>

<figure id="board" class="board mono-scroll m-0 overflow-hidden border border-[var(--rule)] bg-[var(--raised)]">
	<!-- Terminal-style header bar -->
	<figcaption
		class="flex items-center justify-between gap-4 border-b border-[var(--rule)] px-3.5 py-2.5 text-[12px]"
	>
		<a
			href={base}
			class="mono-focus min-w-0 truncate tracking-tight text-[var(--dim)] transition-colors hover:text-[var(--accent)]"
		>
			<span class="text-[var(--faint)]">~/</span>{wsSlug}<span class="text-[var(--faint)]">/</span>{slug}<span
				class="text-[var(--faint)]">/board</span
			>
		</a>
		<span class="flex shrink-0 items-center gap-3 text-[var(--faint)]">
			<span class="flex items-center gap-1.5" title="Live — this board updates as work moves">
				<span
					class="live-dot inline-block size-1.5 rounded-full"
					class:is-live={connected}
					aria-hidden="true"
				></span>
				<span style={connected ? 'color:var(--accent)' : ''}>live</span>
			</span>
			<span class="tabular-nums">{ticketTotal} {ticketTotal === 1 ? 'issue' : 'issues'}</span>
		</span>
	</figcaption>

	<!-- One-line live ticker: what just came over the wire, in the document's voice. -->
	<div class="h-6 overflow-hidden border-b border-[var(--rule)] px-3.5" aria-hidden="true">
		{#if liveLine}
			<p class="live-line flex h-6 items-center truncate text-[11px] text-[var(--accent)]">
				<span class="mr-1.5 text-[var(--faint)]">&gt;</span>{liveLine}
			</p>
		{:else}
			<p class="flex h-6 items-center truncate text-[11px] text-[var(--faint)]">
				<span class="mr-1.5">&gt;</span>watching {columns.length} columns · {total} public {total === 1
					? 'issue'
					: 'issues'}
			</p>
		{/if}
	</div>

	<div class="mono-scroll overflow-x-auto">
		<div class="flex w-max items-start">
			{#each columns as col (col.id)}
				<section class="w-[74vw] max-w-[19rem] shrink-0 border-r border-[var(--rule)] last:border-r-0 sm:w-72">
					<header class="flex items-center justify-between gap-2 px-3.5 py-2.5">
						<span class="flex min-w-0 items-center gap-2">
							<span
								class="inline-block size-2 shrink-0 rounded-full"
								style={`background:${col.color}`}
								aria-hidden="true"
							></span>
							<span class="truncate text-[12px] tracking-wide text-[var(--text)] uppercase">{col.name}</span>
						</span>
						<span class="shrink-0 text-[11px] tabular-nums text-[var(--faint)]">
							{col.tickets.length.toString().padStart(2, '0')}
						</span>
					</header>

					<div class="pb-2">
						{#each col.tickets.slice(0, CAP) as t (t.id)}
							<a
								href={`${base}/t/${t.number}`}
								class="ticket mono-focus block px-3.5 py-2 transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_9%,transparent)]"
								class:is-flash={flashId === t.id}
								style={`--edge:${col.color}`}
							>
								<span class="flex items-baseline gap-2 text-[13px]">
									<span class="shrink-0 tabular-nums text-[var(--faint)]">#{t.number}</span>
									<span class="min-w-0 flex-1 truncate text-[var(--text)]">{t.title}</span>
									{#if t.votes > 0}
										<span class="shrink-0 text-[11px] tabular-nums text-[var(--dim)]">▲{t.votes}</span>
									{/if}
								</span>
								{#if t.labels.length}
									<span class="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 pl-[4.2ch] text-[10px]">
										{#each t.labels.slice(0, 3) as l (l.id)}
											<span style={`color:${l.color}`}>#{l.name}</span>
										{/each}
									</span>
								{/if}
							</a>
						{/each}
						{#if col.tickets.length === 0}
							<p class="px-3.5 py-3 text-[11px] text-[var(--faint)]">— empty —</p>
						{/if}
						{#if col.tickets.length > CAP}
							<a
								href={base}
								class="mono-focus block px-3.5 py-2 text-[11px] text-[var(--faint)] transition-colors hover:text-[var(--accent)]"
							>
								+{col.tickets.length - CAP} more →
							</a>
						{/if}
					</div>
				</section>
			{/each}
		</div>
	</div>
</figure>

<style>
	.ticket {
		border-left: 2px solid transparent;
	}
	.ticket:hover {
		border-left-color: var(--edge);
	}
	.ticket.is-flash {
		border-left-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}

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
		.ticket.is-flash {
			animation: mono-flash 0.95s ease-out;
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
	@keyframes mono-flash {
		from {
			background: color-mix(in srgb, var(--accent) 22%, transparent);
		}
		to {
			background: color-mix(in srgb, var(--accent) 12%, transparent);
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
