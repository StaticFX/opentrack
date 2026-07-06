<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { dndzone } from 'svelte-dnd-action';
	import { Plus, Settings2, Trash2, ArrowLeft, ArrowRight, Search, X, CheckSquare } from '@lucide/svelte';
	import { COLUMN_CATEGORIES, PRIORITIES, type ColumnCategory } from '$lib/constants';
	import { COLUMN_ICON_KEYS } from '$lib/columnIcons';
	import { PALETTE } from '$lib/colors';
	import { PRIORITY_META } from '$lib/priority';
	import { rankAfter, rankBefore, rankBetween, rankForDrop } from '$lib/rank';
	import type { TicketCard } from '$lib/board';
	import { clickOutside } from '$lib/utils/clickOutside';
	import Select from '$lib/components/ui/Select.svelte';
	import BoardViews from './BoardViews.svelte';
	import Card from './Card.svelte';
	import ColumnIcon from './ColumnIcon.svelte';
	import TicketModal from './TicketModal.svelte';

	const CATEGORY_OPTIONS = COLUMN_CATEGORIES.map((c) => ({
		value: c,
		label: c.replace('_', ' ').replace(/^\w/, (m) => m.toUpperCase())
	}));
	const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({
		value: p,
		label: PRIORITY_META[p].label,
		color: p === 'none' ? undefined : PRIORITY_META[p].color
	}));

	type ColumnDef = {
		id: string;
		name: string;
		color: string;
		icon: string | null;
		category: string;
		wipLimit: number | null;
		position: string;
	};
	type Props = {
		boardId: string;
		projectId: string;
		columns: ColumnDef[];
		tickets: TicketCard[];
		labels: Array<{ id: string; name: string; color: string }>;
		canEdit: boolean;
		canManage: boolean;
		currentUser: { id: string; displayName: string; avatarUrl: string | null };
	};
	let { boardId, projectId, columns, tickets, labels, canEdit, canManage, currentUser }: Props =
		$props();

	type Col = ColumnDef & { items: TicketCard[] };

	function build(cols: ColumnDef[], ts: TicketCard[]): Col[] {
		return cols.map((c) => ({
			...c,
			items: ts
				.filter((t) => t.columnId === c.id)
				.slice()
				.sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0))
		}));
	}

	let cols = $state<Col[]>(build(columns, tickets));
	// Reconcile from server whenever the loaded data changes (e.g. via SSE invalidation).
	$effect(() => {
		cols = build(columns, tickets);
	});

	let selectedTicket = $state<string | null>(null);

	// ── Bulk selection ───────────────────────────────────────────────────
	let selectMode = $state(false);
	let selectedIds = $state<string[]>([]);
	let bulkMembers = $state<Array<{ userId: string; displayName: string }>>([]);
	function toggleSelect(id: string) {
		selectedIds = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
	}
	function cardClick(id: string) {
		if (selectMode) toggleSelect(id);
		else selectedTicket = id;
	}
	async function enterSelect() {
		selectMode = true;
		if (!bulkMembers.length) {
			const res = await fetch(`/api/projects/${projectId}/members`);
			if (res.ok) bulkMembers = (await res.json()).members;
		}
	}
	function exitSelect() {
		selectMode = false;
		selectedIds = [];
	}
	async function bulkAction(action: string, extra: Record<string, unknown> = {}) {
		if (!selectedIds.length) return;
		if (action === 'delete' && !confirm(`Delete ${selectedIds.length} ticket(s)? This cannot be undone.`)) return;
		const res = await fetch(`/api/boards/${boardId}/bulk`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action, ticketIds: selectedIds, ...extra })
		});
		if (res.ok) { selectedIds = []; await invalidate(`board:${boardId}`); }
	}
	const bulkColumnOptions = $derived([{ value: '', label: 'Move to…' }, ...columns.map((c) => ({ value: c.id, label: c.name }))]);
	const bulkLabelOptions = $derived([{ value: '', label: 'Add label…' }, ...labels.map((l) => ({ value: l.id, label: l.name }))]);
	const bulkMemberOptions = $derived([{ value: '', label: 'Assign…' }, ...bulkMembers.map((m) => ({ value: m.userId, label: m.displayName }))]);
	let composerCol = $state<string | null>(null);
	let composerText = $state('');
	let menuCol = $state<string | null>(null);
	const flip = 150;

	const jsonHeaders = { 'content-type': 'application/json' };

	// ── Filtering ────────────────────────────────────────────────────────
	let fq = $state('');
	let fLabel = $state('');
	let fAssignee = $state('');
	let fPriority = $state('');
	const filterActive = $derived(!!(fq.trim() || fLabel || fAssignee || fPriority));

	const labelOptions = $derived([{ value: '', label: 'All labels' }, ...labels.map((l) => ({ value: l.id, label: l.name, color: l.color }))]);
	const priorityFilterOptions = $derived([
		{ value: '', label: 'Any priority' },
		...PRIORITY_OPTIONS
	]);
	const assigneeOptions = $derived.by(() => {
		const seen = new Map<string, string>();
		for (const t of tickets) for (const a of t.assignees) seen.set(a.userId, a.displayName);
		return [{ value: '', label: 'Anyone' }, ...[...seen].map(([value, label]) => ({ value, label }))];
	});

	function matches(t: TicketCard): boolean {
		const q = fq.trim().toLowerCase();
		if (q && !(`#${t.number} ${t.title}`.toLowerCase().includes(q))) return false;
		if (fLabel && !t.labels.some((l) => l.id === fLabel)) return false;
		if (fAssignee && !t.assignees.some((a) => a.userId === fAssignee)) return false;
		if (fPriority && t.priority !== fPriority) return false;
		return true;
	}
	function display(col: Col): TicketCard[] {
		return filterActive ? col.items.filter(matches) : col.items;
	}
	function clearFilters() {
		fq = '';
		fLabel = '';
		fAssignee = '';
		fPriority = '';
	}
	/** Apply a saved view's filters to the live filter controls. */
	function applyView(f: { q?: string; label?: string; assignee?: string; priority?: string }) {
		fq = f.q ?? '';
		fLabel = f.label ?? '';
		fAssignee = f.assignee ?? '';
		fPriority = f.priority ?? '';
	}

	// ── Drag & drop ──────────────────────────────────────────────────────
	function consider(col: Col, e: CustomEvent) {
		col.items = e.detail.items;
	}
	function finalize(col: Col, e: CustomEvent) {
		col.items = e.detail.items;
		const id = e.detail.info.id as string;
		const idx = col.items.findIndex((i) => i.id === id);
		if (idx === -1) return; // this is the source zone
		const prev = col.items[idx - 1];
		const next = col.items[idx + 1];
		const position = rankForDrop(prev?.position, next?.position);
		const card = col.items[idx];
		if (card.position === position && card.columnId === col.id) return;
		card.position = position;
		card.columnId = col.id;
		void fetch(`/api/tickets/${id}/move`, {
			method: 'POST',
			headers: jsonHeaders,
			body: JSON.stringify({ columnId: col.id, position })
		});
	}

	// ── New ticket ───────────────────────────────────────────────────────
	async function createTicket(col: Col) {
		const title = composerText.trim();
		if (!title) return;
		composerText = '';
		composerCol = null;
		await fetch(`/api/boards/${boardId}/tickets`, {
			method: 'POST',
			headers: jsonHeaders,
			body: JSON.stringify({ columnId: col.id, title })
		});
		await invalidate(`board:${boardId}`);
	}

	// ── Column editing ───────────────────────────────────────────────────
	async function patchColumn(id: string, body: Record<string, unknown>) {
		await fetch(`/api/columns/${id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(body) });
		await invalidate(`board:${boardId}`);
	}
	async function addColumn() {
		await fetch(`/api/boards/${boardId}/columns`, {
			method: 'POST',
			headers: jsonHeaders,
			body: JSON.stringify({ name: 'New column' })
		});
		await invalidate(`board:${boardId}`);
	}
	async function deleteColumn(id: string) {
		menuCol = null;
		const res = await fetch(`/api/columns/${id}`, { method: 'DELETE' });
		if (!res.ok) alert((await res.json().catch(() => ({}))).message ?? 'Cannot delete column');
		await invalidate(`board:${boardId}`);
	}
	async function moveColumn(index: number, dir: -1 | 1) {
		const j = index + dir;
		if (j < 0 || j >= cols.length) return;
		// `cols` is sorted ascending by position; place the column past its neighbor.
		let position: string;
		if (dir === -1) {
			const before = cols[j - 1];
			position = before ? rankBetween(before.position, cols[j].position) : rankBefore(cols[j].position);
		} else {
			const after = cols[j + 1];
			position = after ? rankBetween(cols[j].position, after.position) : rankAfter(cols[j].position);
		}
		await patchColumn(cols[index].id, { position });
	}

	// ── Live updates ─────────────────────────────────────────────────────
	onMount(() => {
		const es = new EventSource(`/api/sse/board/${boardId}`);
		const handler = (ev: MessageEvent) => {
			try {
				const d = JSON.parse(ev.data);
				if (d.origin && d.origin === currentUser.id) return; // ignore our own echoes
				void invalidate(`board:${boardId}`);
			} catch {
				/* ignore */
			}
		};
		[
			'ticket.created',
			'ticket.moved',
			'ticket.updated',
			'ticket.deleted',
			'ticket.commented',
			'ticket.voted',
			'column.created',
			'column.updated',
			'column.deleted'
		].forEach((t) => es.addEventListener(t, handler));
		return () => es.close();
	});
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<!-- Filter bar -->
	<div class="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-2 dark:border-neutral-800/60">
		<div class="relative">
			<Search size={14} class="absolute top-1/2 left-2.5 -translate-y-1/2 text-neutral-400" />
			<input
				bind:value={fq}
				placeholder="Search…"
				class="h-8 w-44 rounded-md border border-neutral-200 bg-white pr-2 pl-8 text-sm focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:border-neutral-800 dark:bg-neutral-900"
			/>
		</div>
		<Select bind:value={fLabel} options={labelOptions} size="sm" class="w-36" />
		<Select bind:value={fAssignee} options={assigneeOptions} size="sm" class="w-32" />
		<Select bind:value={fPriority} options={priorityFilterOptions} size="sm" class="w-32" />
		{#if filterActive}
			<button onclick={clearFilters} class="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"><X size={13} /> Clear</button>
		{/if}
		<div class="ml-auto flex items-center gap-2">
			{#if canEdit}
				<button
					onclick={() => (selectMode ? exitSelect() : enterSelect())}
					class={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm ${selectMode ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
				>
					<CheckSquare size={14} /> {selectMode ? 'Done' : 'Select'}
				</button>
			{/if}
			<BoardViews
				{boardId}
				current={{ q: fq, label: fLabel, assignee: fAssignee, priority: fPriority }}
				{filterActive}
				canShare={canEdit}
				onapply={applyView}
			/>
		</div>
	</div>

	<div class="min-h-0 flex-1 overflow-x-auto">
	<div class="flex h-full min-w-max items-stretch gap-3 p-4">
		{#each cols as col, i (col.id)}
			{@const items = display(col)}
			{@const over = col.wipLimit != null && items.length > col.wipLimit}
			<section class="flex h-full min-h-0 w-72 flex-col rounded-xl bg-neutral-50 dark:bg-neutral-900/40">
				<div class="flex items-center justify-between px-3 py-2.5">
					<div class="flex min-w-0 items-center gap-2">
						<ColumnIcon icon={col.icon} color={col.color} />
						<span class="truncate text-sm font-medium">{col.name}</span>
						<span class="text-xs {over ? 'font-semibold text-red-500' : 'text-neutral-400'}">
							{items.length}{col.wipLimit != null ? `/${col.wipLimit}` : ''}
						</span>
					</div>
					<div class="flex items-center gap-0.5">
						{#if canEdit}
							<button onclick={() => (composerCol = composerCol === col.id ? null : col.id)} class="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800" aria-label="Add ticket"><Plus size={15} /></button>
						{/if}
						{#if canManage}
							<div class="relative">
								<button onclick={() => (menuCol = menuCol === col.id ? null : col.id)} class="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800" aria-label="Column settings"><Settings2 size={14} /></button>
								{#if menuCol === col.id}
									<div use:clickOutside={() => (menuCol = null)} class="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-neutral-200 bg-white p-3 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
										<input
											value={col.name}
											onchange={(e) => patchColumn(col.id, { name: (e.currentTarget as HTMLInputElement).value })}
											class="mb-2 w-full rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
										/>
										<p class="mb-1 text-[11px] text-neutral-400">Color</p>
										<div class="mb-2 flex flex-wrap gap-1">
											{#each PALETTE as c (c)}
												<button onclick={() => patchColumn(col.id, { color: c })} class="size-5 rounded-full" class:ring-2={col.color === c} style={`background:${c};--tw-ring-color:${c}`} aria-label={c}></button>
											{/each}
										</div>
										<p class="mb-1 text-[11px] text-neutral-400">Icon</p>
										<div class="mb-2 flex flex-wrap gap-1">
											{#each COLUMN_ICON_KEYS as key (key)}
												<button onclick={() => patchColumn(col.id, { icon: key })} class="grid size-6 place-items-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800" class:bg-neutral-200={col.icon === key} aria-label={key}>
													<ColumnIcon icon={key} color={col.color} size={14} />
												</button>
											{/each}
										</div>
										<p class="mb-1 text-[11px] text-neutral-400">Type (GitHub state)</p>
										<Select
											value={col.category}
											options={CATEGORY_OPTIONS}
											size="sm"
											class="mb-2"
											onchange={(v) => patchColumn(col.id, { category: v as ColumnCategory })}
										/>
										<div class="mb-2 flex items-center gap-2">
											<span class="text-[11px] text-neutral-400">WIP limit</span>
											<input type="number" min="0" value={col.wipLimit ?? ''} onchange={(e) => { const v = (e.currentTarget as HTMLInputElement).value; patchColumn(col.id, { wipLimit: v === '' ? null : Number(v) }); }} class="w-16 rounded border border-neutral-200 px-1 py-0.5 text-xs dark:border-neutral-700 dark:bg-neutral-900" />
										</div>
										<div class="flex items-center justify-between border-t border-neutral-100 pt-2 dark:border-neutral-800">
											<div class="flex gap-1">
												<button onclick={() => moveColumn(i, -1)} disabled={i === 0} class="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800" aria-label="Move left"><ArrowLeft size={14} /></button>
												<button onclick={() => moveColumn(i, 1)} disabled={i === cols.length - 1} class="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800" aria-label="Move right"><ArrowRight size={14} /></button>
											</div>
											<button onclick={() => deleteColumn(col.id)} class="flex items-center gap-1 text-xs text-red-600 hover:underline"><Trash2 size={13} /> Delete</button>
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>

				{#if composerCol === col.id}
					<div class="px-2 pb-2">
						<!-- svelte-ignore a11y_autofocus -->
						<textarea
							bind:value={composerText}
							autofocus
							placeholder="Ticket title…"
							onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); createTicket(col); } if (e.key === 'Escape') { composerCol = null; composerText = ''; } }}
							class="w-full resize-none rounded-lg border border-neutral-200 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
							rows="2"
						></textarea>
					</div>
				{/if}

				<div
					class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
					use:dndzone={{
						items,
						flipDurationMs: flip,
						dragDisabled: !canEdit || filterActive || selectMode,
						dropTargetStyle: {},
						dropTargetClasses: ['ring-2', 'ring-brand-500/40', 'rounded-lg'],
						type: 'card'
					}}
					onconsider={(e) => consider(col, e)}
					onfinalize={(e) => finalize(col, e)}
				>
					{#each items as item (item.id)}
						<div class="shrink-0">
							<div class={selectMode && selectedIds.includes(item.id) ? 'rounded-xl ring-2 ring-brand-500 ring-offset-1 dark:ring-offset-neutral-900' : ''}>
								<Card ticket={item} onopen={cardClick} />
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/each}

		{#if canManage}
			<button onclick={addColumn} class="mt-0 flex w-56 items-center gap-2 rounded-xl border border-dashed border-neutral-300 px-3 py-2.5 text-sm text-neutral-500 hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900">
				<Plus size={15} /> Add column
			</button>
		{/if}
	</div>
</div>
</div>

{#if selectMode && selectedIds.length}
	{@const sc = 'h-8 rounded-md border border-neutral-200 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-800'}
	<div class="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
		<span class="px-1 text-sm font-medium">{selectedIds.length} selected</span>
		<select class={sc} onchange={(e) => { const v = e.currentTarget.value; if (v) bulkAction('move', { columnId: v }); e.currentTarget.value = ''; }}>
			{#each bulkColumnOptions as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
		</select>
		<select class={sc} onchange={(e) => { const v = e.currentTarget.value; if (v) bulkAction('label', { labelId: v }); e.currentTarget.value = ''; }}>
			{#each bulkLabelOptions as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
		</select>
		<select class={sc} onchange={(e) => { const v = e.currentTarget.value; if (v) bulkAction('assign', { userId: v }); e.currentTarget.value = ''; }}>
			{#each bulkMemberOptions as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
		</select>
		{#if canManage}
			<button onclick={() => bulkAction('delete')} class="flex h-8 items-center gap-1 rounded-md px-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"><Trash2 size={14} /> Delete</button>
		{/if}
		<button onclick={() => (selectedIds = [])} class="h-8 rounded-md px-2 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">Clear</button>
	</div>
{/if}

{#if selectedTicket}
	<TicketModal
		ticketId={selectedTicket}
		{boardId}
		{projectId}
		{labels}
		{columns}
		{currentUser}
		onclose={() => (selectedTicket = null)}
		onchanged={() => invalidate(`board:${boardId}`)}
	/>
{/if}
