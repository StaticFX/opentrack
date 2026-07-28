<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { dndzone, dragHandleZone, dragHandle } from 'svelte-dnd-action';
	import { Plus, Settings2, Trash2, GripVertical, Search, X, CheckSquare, Archive } from '@lucide/svelte';
	import { COLUMN_CATEGORIES, PRIORITIES, type ColumnCategory } from '$lib/constants';
	import { COLUMN_ICON_KEYS } from '$lib/columnIcons';
	import { PALETTE } from '$lib/colors';
	import { PRIORITY_META } from '$lib/priority';
	import { rankAfter, rankBefore, rankBetween, rankForDrop } from '$lib/rank';
	import { FILTER_NONE, filterCount, normalizeFilters, ticketMatchesFilters, type BoardFilters, type TicketCard } from '$lib/board';
	import type { CustomFieldDef } from '$lib/customFields';
	import Select from '$lib/components/ui/Select.svelte';
	import BoardFilter, { type FilterSection } from './BoardFilter.svelte';
	import BoardViews from './BoardViews.svelte';
	import Card from './Card.svelte';
	import ColumnIcon from './ColumnIcon.svelte';
	import CreateTicketModal from './CreateTicketModal.svelte';
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
		fields: CustomFieldDef[];
		canEdit: boolean;
		canManage: boolean;
		showArchived: boolean;
		currentUser: { id: string; displayName: string; avatarUrl: string | null };
	};
	let { boardId, projectId, columns, tickets, labels, fields, canEdit, canManage, showArchived, currentUser }: Props =
		$props();

	function toggleArchived() {
		const u = new URL(page.url);
		if (showArchived) u.searchParams.delete('archived');
		else u.searchParams.set('archived', '1');
		goto(`${u.pathname}${u.search}`, { noScroll: true });
	}

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
	let showCreate = $state(false);
	let createCol = $state<string | undefined>(undefined);

	// Deep link: `?ticket=<id>` opens that ticket (used by in-app notifications).
	const urlTicket = $derived(page.url.searchParams.get('ticket'));
	$effect(() => {
		if (urlTicket) selectedTicket = urlTicket;
	});
	function closeTicket() {
		selectedTicket = null;
		// Drop the deep-link param so a refresh / back doesn't reopen it.
		if (page.url.searchParams.has('ticket')) {
			const u = new URL(page.url);
			u.searchParams.delete('ticket');
			goto(`${u.pathname}${u.search}`, { noScroll: true, replaceState: true, keepFocus: true });
		}
	}

	function openCreate(colId?: string) {
		if (!canEdit) return;
		createCol = colId;
		showCreate = true;
	}

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
	// Multi-value, combinable filters (OR within a dimension, AND across).
	let filters = $state<BoardFilters>({});
	const filterActive = $derived(filterCount(filters) > 0);

	const columnFilterOptions = $derived(columns.map((c) => ({ value: c.id, label: c.name, color: c.color })));
	const labelFilterOptions = $derived(labels.map((l) => ({ value: l.id, label: l.name, color: l.color })));
	const priorityFilterOptions = PRIORITY_OPTIONS;
	// Assignees + milestones aren't passed as props, so derive them from the
	// tickets currently on the board (plus a "none" pseudo-option).
	const assigneeFilterOptions = $derived.by(() => {
		const seen = new Map<string, string>();
		for (const t of tickets) for (const a of t.assignees) if (a.userId) seen.set(a.userId, a.displayName);
		return [...[...seen].map(([value, label]) => ({ value, label })), { value: FILTER_NONE, label: 'Unassigned' }];
	});
	const milestoneFilterOptions = $derived.by(() => {
		const seen = new Map<string, string>();
		for (const t of tickets) if (t.milestone) seen.set(t.milestone.id, t.milestone.title);
		const opts = [...seen].map(([value, label]) => ({ value, label }));
		return opts.length ? [...opts, { value: FILTER_NONE, label: 'No milestone' }] : [];
	});
	// Custom fields become filter dimensions too (select + checkbox — the ones
	// with a fixed, enumerable value set). Values live under `filters.fields`.
	const fieldSections = $derived<FilterSection[]>(
		fields
			.filter((f) => f.type === 'select' || f.type === 'checkbox')
			.map((f) => ({
				id: f.id,
				label: f.name,
				field: true,
				options:
					f.type === 'checkbox'
						? [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]
						: (f.options ?? []).map((o) => ({ value: o, label: o }))
			}))
			.filter((s) => s.options.length > 0)
	);
	const filterSections = $derived<FilterSection[]>([
		{ id: 'columns', label: 'Status', options: columnFilterOptions },
		{ id: 'priorities', label: 'Priority', options: priorityFilterOptions },
		{ id: 'assignees', label: 'Assignee', options: assigneeFilterOptions },
		{ id: 'labels', label: 'Label', options: labelFilterOptions },
		{ id: 'milestones', label: 'Milestone', options: milestoneFilterOptions },
		...fieldSections
	]);

	function display(col: Col): TicketCard[] {
		return filterActive ? col.items.filter((t) => ticketMatchesFilters(t, filters)) : col.items;
	}
	function clearFilters() {
		filters = {};
	}
	/** Apply a saved view's filters (normalizing the legacy single-value shape). */
	function applyView(f: unknown) {
		filters = normalizeFilters(f);
	}

	// Removable chips — one per selected value, for at-a-glance active filters.
	type Chip = { id: string; field: boolean; value: string; label: string; color?: string };
	function sectionSelected(s: FilterSection): string[] {
		return (s.field ? filters.fields?.[s.id] : (filters[s.id as keyof BoardFilters] as string[])) ?? [];
	}
	const chips = $derived.by(() => {
		const out: Chip[] = [];
		for (const s of filterSections) {
			for (const v of sectionSelected(s)) {
				const o = s.options.find((x) => x.value === v);
				out.push({ id: s.id, field: !!s.field, value: v, label: o?.label ?? v, color: o?.color });
			}
		}
		return out;
	});
	function removeChip(c: Chip) {
		if (c.field) {
			const cur = filters.fields?.[c.id] ?? [];
			filters = { ...filters, fields: { ...(filters.fields ?? {}), [c.id]: cur.filter((v) => v !== c.value) } };
		} else {
			const cur = (filters[c.id as keyof BoardFilters] as string[] | undefined) ?? [];
			filters = { ...filters, [c.id]: cur.filter((v) => v !== c.value) };
		}
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
	async function archiveColumnTickets(col: Col) {
		menuCol = null;
		const n = col.items.filter((t) => !t.archived).length;
		if (n === 0) return;
		if (!confirm(`Archive ${n} ticket${n === 1 ? '' : 's'} in “${col.name}”? They'll be hidden from the board — toggle “Archived” to restore.`)) return;
		await fetch(`/api/columns/${col.id}/archive`, { method: 'POST' });
		await invalidate(`board:${boardId}`);
	}
	// ── Column reordering (drag handle) ──────────────────────────────────
	function considerCols(e: CustomEvent) {
		cols = e.detail.items;
	}
	async function finalizeCols(e: CustomEvent) {
		cols = e.detail.items;
		const id = e.detail.info?.id as string | undefined;
		const idx = cols.findIndex((c) => c.id === id);
		if (idx < 0 || !id) return;
		const prev = cols[idx - 1];
		const next = cols[idx + 1];
		let position: string;
		if (prev && next) position = rankBetween(prev.position, next.position);
		else if (prev) position = rankAfter(prev.position);
		else if (next) position = rankBefore(next.position);
		else return;
		await patchColumn(id, { position });
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

	// Open the create modal from the header button / ⌘K command, or the `c` hotkey.
	onMount(() => {
		const openEvt = () => openCreate();
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'c' || e.metaKey || e.ctrlKey || e.altKey) return;
			if (selectedTicket || showCreate) return;
			const el = e.target as HTMLElement | null;
			if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
			e.preventDefault();
			openCreate();
		};
		window.addEventListener('new-ticket', openEvt);
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('new-ticket', openEvt);
			window.removeEventListener('keydown', onKey);
		};
	});
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<!-- Filter bar — quiet strip of rounded pill controls (the public pages' voice). -->
	<div class="flex flex-col gap-2 border-b border-black/5 px-4 py-2.5 dark:border-white/8">
		<div class="flex flex-wrap items-center gap-2">
			<div class="relative">
				<Search size={14} class="absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400" />
				<input
					bind:value={filters.q}
					placeholder="Search…"
					class="h-8 w-44 rounded-full border border-black/5 bg-white/70 pr-3 pl-8 text-sm shadow-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent-glow)] focus-visible:outline-none dark:border-white/5 dark:bg-neutral-800/70"
				/>
			</div>
			<BoardFilter bind:filters sections={filterSections} onclear={clearFilters} />
			{#if filterActive}
				<button onclick={clearFilters} class="flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"><X size={13} /> Clear</button>
			{/if}
			<div class="ml-auto flex items-center gap-2">
				<button
					onclick={toggleArchived}
					class={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${showArchived ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-fg)]' : 'border-black/5 bg-white/70 text-neutral-500 hover:text-neutral-800 dark:border-white/5 dark:bg-neutral-800/70 dark:text-neutral-400 dark:hover:text-neutral-200'}`}
					title={showArchived ? 'Hide archived tickets' : 'Show archived tickets'}
				>
					<Archive size={13} /> {showArchived ? 'Archived' : 'Archive'}
				</button>
				{#if canEdit}
					<button
						onclick={() => (selectMode ? exitSelect() : enterSelect())}
						class={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${selectMode ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-fg)]' : 'border-black/5 bg-white/70 text-neutral-500 hover:text-neutral-800 dark:border-white/5 dark:bg-neutral-800/70 dark:text-neutral-400 dark:hover:text-neutral-200'}`}
					>
						<CheckSquare size={13} /> {selectMode ? 'Done' : 'Select'}
					</button>
				{/if}
				<BoardViews {boardId} current={filters} {filterActive} canShare={canEdit} onapply={applyView} />
			</div>
		</div>
		{#if chips.length}
			<div class="flex flex-wrap items-center gap-1.5">
				{#each chips as c (c.id + c.value)}
					<span class="flex items-center gap-1 rounded-full border border-black/5 bg-white/70 py-0.5 pr-1 pl-2 text-xs font-medium text-neutral-600 dark:border-white/5 dark:bg-neutral-800/70 dark:text-neutral-300">
						{#if c.color}<span class="size-2 shrink-0 rounded-full" style={`background:${c.color}`}></span>{/if}
						{c.label}
						<button onclick={() => removeChip(c)} class="rounded-full p-0.5 text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200" aria-label={`Remove ${c.label} filter`}><X size={11} /></button>
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<div class="min-h-0 flex-1 overflow-x-auto">
	<div class="flex h-full min-w-max items-stretch gap-3 p-4">
		<section
			class="flex h-full items-stretch gap-3"
			use:dragHandleZone={{ items: cols, type: 'column', flipDurationMs: flip, dropTargetStyle: {} }}
			onconsider={considerCols}
			onfinalize={finalizeCols}
		>
		{#each cols as col (col.id)}
			{@const items = display(col)}
			{@const over = col.wipLimit != null && items.length > col.wipLimit}
			<!-- Recessed well: the column is a quiet tray the ticket cards float inside. -->
			<section class="group/col flex h-full min-h-0 w-72 flex-col rounded-2xl bg-black/[0.03] dark:bg-white/[0.04]">
				<div class="flex items-center justify-between px-3 py-2.5">
					<div class="flex min-w-0 items-center gap-2">
						<ColumnIcon icon={col.icon} color={col.color} />
						<span class="truncate font-display text-sm font-semibold tracking-tight">{col.name}</span>
						<span class="font-mono text-xs tabular-nums {over ? 'font-semibold text-red-500' : 'text-neutral-400'}">
							{items.length}{col.wipLimit != null ? `/${col.wipLimit}` : ''}
						</span>
					</div>
					<div class="flex items-center gap-0.5">
						{#if canEdit}
							<button onclick={() => archiveColumnTickets(col)} class="rounded-md p-1 text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-600 dark:hover:bg-white/10 dark:hover:text-neutral-300" aria-label="Archive all tickets" title="Archive all tickets"><Archive size={14} /></button>
						{/if}
						{#if canManage}
							<button use:dragHandle class="cursor-grab rounded-md p-1 text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-600 active:cursor-grabbing dark:hover:bg-white/10 dark:hover:text-neutral-300" aria-label="Drag to reorder column"><GripVertical size={14} /></button>
							<button onclick={() => (menuCol = col.id)} class="rounded-md p-1 text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-600 dark:hover:bg-white/10 dark:hover:text-neutral-300" aria-label="Column settings"><Settings2 size={14} /></button>
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
							class="w-full resize-none rounded-xl border border-black/10 bg-white p-2.5 text-sm shadow-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent-glow)] focus-visible:outline-none dark:border-white/10 dark:bg-neutral-800"
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
						dropTargetClasses: ['ring-2', 'ring-[var(--accent-glow)]', 'rounded-xl'],
						type: 'card'
					}}
					onconsider={(e) => consider(col, e)}
					onfinalize={(e) => finalize(col, e)}
				>
					{#each items as item (item.id)}
						<div class="shrink-0 {item.archived ? 'opacity-60' : ''}">
							<div class={selectMode && selectedIds.includes(item.id) ? 'rounded-xl ring-2 ring-[var(--accent-solid)] ring-offset-1 dark:ring-offset-neutral-800' : ''}>
								<Card ticket={item} onopen={cardClick} />
							</div>
						</div>
					{/each}
					{#if canEdit && !selectMode}
						<button
							onclick={() => openCreate(col.id)}
							class="mt-0.5 hidden shrink-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 py-2 text-xs font-medium text-neutral-500 transition-colors group-hover/col:flex hover:border-[var(--accent-border)] hover:text-[var(--accent-fg)] dark:border-neutral-700"
						>
							<Plus size={14} /> New ticket
						</button>
					{/if}
				</div>
			</section>
		{/each}
		</section>

		{#if canManage}
			<button onclick={addColumn} class="mt-0 flex w-56 items-center gap-2 rounded-2xl border border-dashed border-neutral-300 px-3 py-2.5 text-sm font-medium text-neutral-500 transition-colors hover:border-[var(--accent-border)] hover:bg-black/[0.02] hover:text-[var(--accent-fg)] dark:border-neutral-700 dark:hover:bg-white/[0.04]">
				<Plus size={15} /> Add column
			</button>
		{/if}
	</div>
</div>
</div>

{#if selectMode && selectedIds.length}
	{@const sc = 'h-8 rounded-lg border border-black/10 bg-white px-2 text-sm dark:border-white/10 dark:bg-neutral-900'}
	<div class="fixed inset-x-2 bottom-4 z-40 flex max-w-[calc(100vw-1rem)] flex-wrap items-center justify-center gap-2 rounded-2xl border border-black/5 bg-white px-3 py-2 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:max-w-none sm:-translate-x-1/2 sm:flex-nowrap dark:border-white/8 dark:bg-neutral-800">
		<span class="px-1 text-sm font-medium"><span class="font-mono tabular-nums">{selectedIds.length}</span> selected</span>
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
			<button onclick={() => bulkAction('delete')} class="flex h-8 items-center gap-1 rounded-full px-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"><Trash2 size={14} /> Delete</button>
		{/if}
		<button onclick={() => (selectedIds = [])} class="h-8 rounded-full px-2.5 text-sm text-neutral-500 transition-colors hover:bg-black/5 dark:hover:bg-white/10">Clear</button>
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
		onclose={closeTicket}
		onchanged={() => invalidate(`board:${boardId}`)}
	/>
{/if}

{#if showCreate}
	<CreateTicketModal
		{boardId}
		{projectId}
		{columns}
		{labels}
		defaultColumnId={createCol}
		onclose={() => (showCreate = false)}
		oncreated={() => invalidate(`board:${boardId}`)}
	/>
{/if}

{#if menuCol}
	{@const editing = cols.find((c) => c.id === menuCol)}
	{#if editing}
		<div class="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]">
			<button aria-label="Close" class="absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px]" onclick={() => (menuCol = null)}></button>
			<div class="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-black/5 bg-white shadow-2xl dark:border-white/8 dark:bg-neutral-800">
				<div class="flex items-center justify-between border-b border-black/5 px-5 py-3 dark:border-white/8">
					<h2 class="flex items-center gap-2 font-display text-sm font-semibold tracking-tight"><ColumnIcon icon={editing.icon} color={editing.color} /> Column settings</h2>
					<button onclick={() => (menuCol = null)} class="rounded-md p-1 text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-600 dark:hover:bg-white/10 dark:hover:text-neutral-300" aria-label="Close"><X size={16} /></button>
				</div>
				<div class="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
					<label class="block">
						<span class="pub-label mb-1 block">Name</span>
						<input value={editing.name} onchange={(e) => patchColumn(editing.id, { name: (e.currentTarget as HTMLInputElement).value })} class="w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent-glow)] focus-visible:outline-none dark:border-white/10 dark:bg-neutral-900" />
					</label>
					<div>
						<span class="pub-label mb-1.5 block">Color</span>
						<div class="flex flex-wrap gap-1.5">
							{#each PALETTE as c (c)}<button onclick={() => patchColumn(editing.id, { color: c })} class="size-6 rounded-full transition-transform hover:scale-110" class:ring-2={editing.color === c} style={`background:${c};--tw-ring-color:${c}`} aria-label={c}></button>{/each}
						</div>
					</div>
					<div>
						<span class="pub-label mb-1.5 block">Icon</span>
						<div class="flex flex-wrap gap-1.5">
							{#each COLUMN_ICON_KEYS as key (key)}<button onclick={() => patchColumn(editing.id, { icon: key })} class="grid size-8 place-items-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10 {editing.icon === key ? 'bg-black/10 dark:bg-white/15' : ''}" aria-label={key}><ColumnIcon icon={key} color={editing.color} size={16} /></button>{/each}
						</div>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<label class="block">
							<span class="pub-label mb-1 block">Type (GitHub state)</span>
							<Select value={editing.category} options={CATEGORY_OPTIONS} size="sm" onchange={(v) => patchColumn(editing.id, { category: v as ColumnCategory })} />
						</label>
						<label class="block">
							<span class="pub-label mb-1 block">Ticket limit</span>
							<input type="number" min="0" value={editing.wipLimit ?? ''} onchange={(e) => { const v = (e.currentTarget as HTMLInputElement).value; patchColumn(editing.id, { wipLimit: v === '' ? null : Number(v) }); }} placeholder="No limit" class="w-full rounded-lg border border-black/10 px-3 py-2 font-mono text-sm tabular-nums focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent-glow)] focus-visible:outline-none dark:border-white/10 dark:bg-neutral-900" />
						</label>
					</div>
				</div>
				<div class="flex items-center justify-between border-t border-black/5 px-5 py-3 dark:border-white/8">
					<span class="text-xs text-neutral-400">Drag the grip on a column to reorder</span>
					<button onclick={() => deleteColumn(editing.id)} class="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"><Trash2 size={14} /> Delete column</button>
				</div>
			</div>
		</div>
	{/if}
{/if}
