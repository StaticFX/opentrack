<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { MediaQuery } from 'svelte/reactivity';
	import { prefersReducedMotion } from 'svelte/motion';
	import { dndzone, dragHandleZone, dragHandle } from 'svelte-dnd-action';
	import {
		Plus,
		Settings2,
		Trash2,
		GripVertical,
		Search,
		X,
		CheckSquare,
		Archive,
		Pause,
		Kanban as KanbanIcon,
		LayoutList,
		Inbox as InboxIcon
	} from '@lucide/svelte';
	import { COLUMN_CATEGORIES, PRIORITIES, CLOSED_CATEGORIES, type ColumnCategory } from '$lib/constants';
	import { COLUMN_ICON_KEYS } from '$lib/columnIcons';
	import { PALETTE } from '$lib/colors';
	import { PRIORITY_META } from '$lib/priority';
	import { rankAfter, rankBefore, rankBetween, rankForDrop } from '$lib/rank';
	import { FILTER_NONE, filterCount, normalizeFilters, ticketMatchesFilters, type BoardFilters, type TicketCard } from '$lib/board';
	import type { CustomFieldDef } from '$lib/customFields';
	import { PROJECT_NAV } from '$lib/projectNav';
	import { announce } from '$lib/announce';
	import { toast } from '$lib/toast';
	import { cn } from '$lib/utils/cn';
	import Select from '$lib/components/ui/Select.svelte';
	import Popover from '$lib/components/ui/Popover.svelte';
	import ConfirmPopover from '$lib/components/ui/ConfirmPopover.svelte';
	import EmptyStateApp from '$lib/components/ui/EmptyStateApp.svelte';
	import Kbd from '$lib/components/ui/Kbd.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import ViewHeader, { type Crumb } from '$lib/components/app/ViewHeader.svelte';
	import GradualBlur from '$lib/components/vendor/GradualBlur.svelte';
	import BoardFilter, { type FilterSection } from './BoardFilter.svelte';
	import BoardViews from './BoardViews.svelte';
	import BoardListView from './BoardListView.svelte';
	import Card from './Card.svelte';
	import ColumnIcon from './ColumnIcon.svelte';
	import CreateTicketModal from './CreateTicketModal.svelte';
	import TicketPeek from './TicketPeek.svelte';

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

	// ── Header data (crumbs/live-count) — sourced from page.data like ViewHeader
	// itself does, so this stays a pure presentation concern with no new props
	// threaded through the (sacred) KanbanBoard contract above. ─────────────────
	const pd = $derived(page.data as Record<string, unknown>);
	const wsSlug = $derived(((pd.workspace as { slug?: string } | undefined)?.slug ?? '') as string);
	const projectSlug = $derived(((pd.project as { slug?: string } | undefined)?.slug ?? '') as string);
	const project = $derived(pd.project as { name: string; color?: string | null } | undefined);
	const boardName = $derived((pd.board as { name?: string } | undefined)?.name ?? '');
	const siblingProjects = $derived((pd.projects ?? []) as Array<{ slug: string; name: string }>);
	const boardsList = $derived((pd.boards ?? []) as Array<{ id: string; name: string }>);

	const crumbs = $derived<Crumb[]>([
		{
			label: project?.name ?? '',
			href: `/w/${wsSlug}/p/${projectSlug}`,
			dot: project?.color ?? undefined,
			menu: siblingProjects.length > 1
				? siblingProjects.map((p) => ({ label: p.name, href: `/w/${wsSlug}/p/${p.slug}`, current: p.slug === projectSlug }))
				: undefined
		},
		{
			label: boardName,
			// Boards + sections in one switcher — the strongest crumb on the page.
			menu: [
				...boardsList.map((b) => ({ label: b.name, href: `/w/${wsSlug}/p/${projectSlug}/b/${b.id}`, current: b.id === boardId })),
				...PROJECT_NAV.filter((i) => !i.external && (!i.manageOnly || canManage)).map((i) => ({
					label: i.label,
					href: i.href(wsSlug, projectSlug)
				}))
			]
		}
	]);

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

	const openCount = $derived(
		tickets.filter((t) => {
			const col = columns.find((c) => c.id === t.columnId);
			return !col || !CLOSED_CATEGORIES.includes(col.category as ColumnCategory);
		}).length
	);

	// ── Ticket peek: `?ticket=` is the single source of truth for what's open —
	// history contract lives here (D3): pushState on open, replaceState/`back()`
	// on close depending on whether *this session* pushed the entry. ───────────
	const selectedTicket = $derived(page.url.searchParams.get('ticket'));
	const fullView = $derived(page.url.searchParams.get('full') === '1');
	let pushedDepth = $state(0); // 0 none, 1 pushed `?ticket=`, 2 pushed `&full=1` on top
	// Self-corrects on real Back/Forward navigation, which we don't otherwise observe.
	$effect(() => {
		if (!selectedTicket) pushedDepth = 0;
		else if (!fullView) pushedDepth = Math.min(pushedDepth, 1);
	});

	function openTicket(id: string) {
		if (selectMode) {
			toggleSelect(id);
			return;
		}
		pushedDepth = 1;
		const u = new URL(page.url);
		u.searchParams.set('ticket', id);
		u.searchParams.delete('full');
		goto(`${u.pathname}${u.search}`, { noScroll: true, keepFocus: true });
	}
	/** j/k — replace in place so stepping through cards doesn't grow history. */
	function stepTicket(id: string) {
		const u = new URL(page.url);
		u.searchParams.set('ticket', id);
		goto(`${u.pathname}${u.search}`, { noScroll: true, keepFocus: true, replaceState: true });
	}
	function closeTicket() {
		if (pushedDepth > 0) history.back();
		else {
			const u = new URL(page.url);
			u.searchParams.delete('ticket');
			u.searchParams.delete('full');
			goto(`${u.pathname}${u.search}`, { noScroll: true, replaceState: true, keepFocus: true });
		}
		pushedDepth = 0;
	}
	function toggleFull() {
		const u = new URL(page.url);
		if (fullView) {
			if (pushedDepth >= 2) {
				history.back();
				pushedDepth = 1;
			} else {
				u.searchParams.delete('full');
				goto(`${u.pathname}${u.search}`, { noScroll: true, replaceState: true, keepFocus: true });
			}
		} else {
			u.searchParams.set('full', '1');
			goto(`${u.pathname}${u.search}`, { noScroll: true, keepFocus: true });
			pushedDepth = Math.max(pushedDepth, 1) + 1;
		}
	}

	// Entry-only seeds from the URL (milestones page, "assigned to me" links):
	// read once into client filter state, then replaceState-strip.
	onMount(() => {
		const u = new URL(page.url);
		let seeded = false;
		const milestoneId = u.searchParams.get('milestone');
		if (milestoneId) {
			filters = { ...filters, milestones: [milestoneId] };
			u.searchParams.delete('milestone');
			seeded = true;
		}
		if (u.searchParams.get('assignee') === 'me') {
			filters = { ...filters, assignees: [currentUser.id] };
			u.searchParams.delete('assignee');
			seeded = true;
		}
		if (seeded) goto(`${u.pathname}${u.search}`, { replaceState: true, noScroll: true, keepFocus: true });
	});

	function openCreate(colId?: string) {
		if (!canEdit) return;
		createCol = colId;
		showCreate = true;
	}
	let showCreate = $state(false);
	let createCol = $state<string | undefined>(undefined);

	// ── Bulk selection ───────────────────────────────────────────────────
	let selectMode = $state(false);
	let selectedIds = $state<string[]>([]);
	let bulkMembers = $state<Array<{ userId: string; displayName: string }>>([]);
	function toggleSelect(id: string) {
		selectedIds = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
	}
	function cardClick(id: string) {
		openTicket(id);
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
		if (res.ok) {
			selectedIds = [];
			await invalidate(`board:${boardId}`);
		}
	}
	const bulkColumnOptions = $derived(columns.map((c) => ({ value: c.id, label: c.name })));
	const bulkLabelOptions = $derived(labels.map((l) => ({ value: l.id, label: l.name })));
	const bulkMemberOptions = $derived(bulkMembers.map((m) => ({ value: m.userId, label: m.displayName })));
	let bulkMoveVal = $state('');
	let bulkLabelVal = $state('');
	let bulkAssignVal = $state('');

	let composerCol = $state<string | null>(null);
	let composerText = $state('');
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

	// Flat, filtered, column-ordered list — feeds j/k stepping and the mobile list.
	const filteredCols = $derived(cols.map((c) => ({ ...c, items: display(c) })));
	const flatFiltered = $derived(filteredCols.flatMap((c) => c.items));

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

	// Drag-paused UI cues (feasibility warning #3): the dndzone `dragDisabled`
	// expression below stays byte-identical; this mirrors its *value* for the
	// chip/hint/card-hover presentation layer only.
	const dragPaused = $derived(!canEdit || filterActive || selectMode);
	const pausedReason = $derived(filterActive ? 'filters' : selectMode ? 'selecting' : null);
	const hasChips = $derived(chips.length > 0 || filterActive || selectMode);
	let dragHintShown = $state(false);
	$effect(() => {
		if (!filterActive && !selectMode) dragHintShown = false;
	});
	function onCardPointerDown() {
		if (!canEdit || dragHintShown || !pausedReason) return;
		dragHintShown = true;
		toast(
			pausedReason === 'filters' ? 'Drag paused — clear filters to reorder cards' : 'Drag paused — exit select mode to reorder cards',
			{ tone: 'info' }
		);
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
		const res = await fetch(`/api/columns/${id}`, { method: 'DELETE' });
		if (!res.ok) toast((await res.json().catch(() => ({}))).message ?? 'Cannot delete column', { tone: 'error' });
		await invalidate(`board:${boardId}`);
	}
	// Archive ops carry no confirm — an undo toast is the safety net (D7 law).
	async function archiveColumnTickets(col: Col) {
		const ids = col.items.filter((t) => !t.archived).map((t) => t.id);
		if (!ids.length) return;
		await fetch(`/api/columns/${col.id}/archive`, { method: 'POST' });
		await invalidate(`board:${boardId}`);
		toast.undo(`${ids.length} ticket${ids.length === 1 ? '' : 's'} archived`, async () => {
			await Promise.all(
				ids.map((id) => fetch(`/api/tickets/${id}/archive`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ archived: false }) }))
			);
			await invalidate(`board:${boardId}`);
		});
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
	let flashId = $state<string | null>(null);
	onMount(() => {
		const es = new EventSource(`/api/sse/board/${boardId}`);
		const handler = async (ev: MessageEvent) => {
			try {
				const d = JSON.parse(ev.data);
				if (d.origin && d.origin === currentUser.id) return; // ignore our own echoes
				const changedId = d.data?.ticketId as string | undefined;
				const before = changedId ? tickets.find((t) => t.id === changedId) : undefined;
				await invalidate(`board:${boardId}`);
				if (changedId) {
					flashId = changedId;
					setTimeout(() => {
						if (flashId === changedId) flashId = null;
					}, 900);
					const after = tickets.find((t) => t.id === changedId);
					const t = after ?? before;
					if (t) {
						const verb: Record<string, string> =
							d.type === 'ticket.moved'
								? { text: `moved to ${columns.find((c) => c.id === after?.columnId)?.name ?? 'another column'}` }
								: d.type === 'ticket.created'
									? { text: 'created' }
									: d.type === 'ticket.deleted'
										? { text: 'deleted' }
										: d.type === 'ticket.commented'
											? { text: 'commented' }
											: d.type === 'ticket.voted'
												? { text: 'voted' }
												: { text: 'updated' };
						announce(`#${t.number} ${verb.text}`);
					}
				}
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
	// `/` focuses search; `j`/`k` step through the peek while it's open.
	let searchEl = $state<HTMLInputElement | undefined>();
	onMount(() => {
		const openEvt = () => openCreate();
		const onKey = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			const el = e.target as HTMLElement | null;
			const inField = el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
			if (e.key === '/' && !inField) {
				e.preventDefault();
				searchEl?.focus();
				return;
			}
			if (inField) return;
			if (e.key === 'c') {
				if (selectedTicket || showCreate) return;
				e.preventDefault();
				openCreate();
				return;
			}
			if ((e.key === 'j' || e.key === 'k') && selectedTicket) {
				const idx = flatFiltered.findIndex((t) => t.id === selectedTicket);
				if (idx === -1) return;
				const next = flatFiltered[idx + (e.key === 'j' ? 1 : -1)];
				if (next) {
					e.preventDefault();
					stepTicket(next.id);
				}
			}
		};
		window.addEventListener('new-ticket', openEvt);
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('new-ticket', openEvt);
			window.removeEventListener('keydown', onKey);
		};
	});

	// ── Mobile (<768px): grouped list is the default; board mode is opt-in. ────
	const isWide = new MediaQuery('(min-width: 768px)');
	let mobileBoardMode = $state(false);
	let mobileSearchOpen = $state(false);
	const boardLayout = $derived(isWide.current || mobileBoardMode);

	const overflowItems = $derived([
		...(!isWide.current
			? [
					{
						label: mobileBoardMode ? 'Switch to list view' : 'Switch to board view',
						icon: mobileBoardMode ? LayoutList : KanbanIcon,
						onselect: () => (mobileBoardMode = !mobileBoardMode)
					}
				]
			: []),
		{ label: showArchived ? 'Hide archived tickets' : 'Show archived tickets', icon: Archive, onselect: toggleArchived },
		...(canEdit
			? [{ label: selectMode ? 'Exit select mode' : 'Select tickets', icon: CheckSquare, onselect: () => (selectMode ? exitSelect() : enterSelect()) }]
			: [])
	]);

	// Overflow tint + right-edge fade on the horizontal scroller.
	let scrollerEl = $state<HTMLDivElement | undefined>();
	let hOverflow = $state(false);
	let scrollEls: Record<string, HTMLDivElement> = $state({});
	let colRefs: Record<string, HTMLElement> = $state({});
	let vOverflow = $state<Record<string, boolean>>({});
	function checkOverflow() {
		if (scrollerEl) hOverflow = scrollerEl.scrollWidth > scrollerEl.clientWidth + 1;
		for (const c of cols) {
			const el = scrollEls[c.id];
			if (el) vOverflow[c.id] = el.scrollHeight > el.clientHeight + 1;
		}
	}
	$effect(() => {
		cols; // re-check whenever columns/cards change
		checkOverflow();
	});
	function scrollToColumn(id: string) {
		colRefs[id]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: prefersReducedMotion.current ? 'auto' : 'smooth' });
	}

	const iconBtn =
		'focus-ring hit rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200';
</script>

{#snippet searchToolbar()}
	<div class="relative">
		<Search size={14} class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
		<input
			bind:this={searchEl}
			bind:value={filters.q}
			placeholder="Search…"
			aria-label="Search tickets"
			class="focus-ring h-7 w-40 rounded-full border border-[var(--ot-hairline)] bg-white/70 pr-2.5 pl-7 text-xs dark:bg-neutral-800/70"
		/>
		{#if !filters.q}
			<Kbd keys={['/']} class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 max-sm:hidden" />
		{/if}
	</div>
	<BoardFilter bind:filters sections={filterSections} onclear={clearFilters} />
	<BoardViews {boardId} current={filters} {filterActive} canShare={canEdit} onapply={applyView} />
{/snippet}

{#snippet columnSettings(col: Col)}
	<div class="mb-3 flex items-center gap-2">
		<ColumnIcon icon={col.icon} color={col.color} />
		<h2 class="text-sm font-semibold tracking-tight">Column settings</h2>
	</div>
	<div class="max-h-[60vh] space-y-3 overflow-y-auto">
		<label class="block">
			<span class="mb-1 block text-[11px] font-medium text-neutral-500">Name</span>
			<input
				value={col.name}
				onchange={(e) => patchColumn(col.id, { name: (e.currentTarget as HTMLInputElement).value })}
				class="focus-ring w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm dark:border-neutral-800 dark:bg-neutral-900"
			/>
		</label>
		<div>
			<span class="mb-1.5 block text-[11px] font-medium text-neutral-500">Color</span>
			<div class="flex flex-wrap gap-1.5">
				{#each PALETTE as c (c)}
					<button onclick={() => patchColumn(col.id, { color: c })} class="size-6 rounded-full transition-transform hover:scale-110" class:ring-2={col.color === c} style={`background:${c};--tw-ring-color:${c}`} aria-label={c}></button>
				{/each}
			</div>
		</div>
		<div>
			<span class="mb-1.5 block text-[11px] font-medium text-neutral-500">Icon</span>
			<div class="flex flex-wrap gap-1.5">
				{#each COLUMN_ICON_KEYS as key (key)}
					<button
						onclick={() => patchColumn(col.id, { icon: key })}
						class={cn('grid size-8 place-items-center rounded-lg transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800', col.icon === key && 'bg-neutral-100 dark:bg-neutral-800')}
						aria-label={key}><ColumnIcon icon={key} color={col.color} size={16} /></button
					>
				{/each}
			</div>
		</div>
		<div class="grid grid-cols-2 gap-3">
			<label class="block">
				<span class="mb-1 block text-[11px] font-medium text-neutral-500">Type (GitHub state)</span>
				<Select value={col.category} options={CATEGORY_OPTIONS} size="sm" onchange={(v) => patchColumn(col.id, { category: v as ColumnCategory })} />
			</label>
			<label class="block">
				<span class="mb-1 block text-[11px] font-medium text-neutral-500">Ticket limit</span>
				<input
					type="number"
					min="0"
					value={col.wipLimit ?? ''}
					onchange={(e) => {
						const v = (e.currentTarget as HTMLInputElement).value;
						patchColumn(col.id, { wipLimit: v === '' ? null : Number(v) });
					}}
					placeholder="No limit"
					class="focus-ring data-mono w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm dark:border-neutral-800 dark:bg-neutral-900"
				/>
			</label>
		</div>
	</div>
	<div class="hairline-t mt-3 flex items-center justify-between pt-3">
		<button onclick={() => archiveColumnTickets(col)} class="focus-ring flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
			<Archive size={13} /> Archive tickets
		</button>
		<ConfirmPopover message={`Delete "${col.name}"? Its tickets stay on the board without a status.`} confirmLabel="Delete column" onconfirm={() => deleteColumn(col.id)} placement="top-end">
			{#snippet trigger(tp)}
				<button type="button" {...tp} class="focus-ring flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-500/10 dark:hover:bg-red-500/10"><Trash2 size={13} /> Delete</button>
			{/snippet}
		</ConfirmPopover>
	</div>
{/snippet}

{#snippet chipsRow()}
	{#each chips as c (c.id + c.value)}
		<span class="focus-ring flex h-6 items-center gap-1 rounded-full border border-[var(--ot-hairline)] py-0.5 pr-1 pl-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
			{#if c.color}<span class="size-2 shrink-0 rounded-full" style={`background:${c.color}`}></span>{/if}
			{c.label}
			<button
				onclick={() => removeChip(c)}
				class="rounded-full p-0.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
				aria-label={`Remove ${c.label} filter`}><X size={11} /></button
			>
		</span>
	{/each}
	{#if filterActive}
		<button onclick={clearFilters} class="focus-ring flex h-6 items-center gap-1 rounded-full px-1.5 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200">
			<X size={11} /> Clear
		</button>
	{/if}
	{#if pausedReason && canEdit}
		<span class="chip-paused ml-auto">
			<Pause size={11} /> Drag paused — {pausedReason}
		</span>
	{/if}
{/snippet}

<div class={boardLayout ? 'flex h-full min-h-0 flex-col' : 'flex flex-col'}>
	<ViewHeader
		{crumbs}
		live={{ text: `${openCount} open`, beat: true }}
		overflow={overflowItems}
		chips={hasChips ? chipsRow : undefined}
	>
		{#snippet toolbar()}
			{#if isWide.current}
				<div class="flex items-center gap-1.5">
					{@render searchToolbar()}
				</div>
			{:else}
				<button
					type="button"
					onclick={() => (mobileSearchOpen = true)}
					class={iconBtn}
					title="Search tickets"
					aria-label="Search and filter tickets"
				>
					<Search size={14} aria-hidden="true" />
				</button>
				<Sheet
					bind:open={mobileSearchOpen}
					side="bottom"
					size="sm"
					ariaLabel="Search and filter tickets"
					class="flex flex-col gap-3 p-3"
				>
					<div class="flex flex-wrap items-center gap-1.5">
						{@render searchToolbar()}
					</div>
				</Sheet>
			{/if}
		{/snippet}
		{#snippet actions()}
			{#if canEdit}
				<button
					type="button"
					onclick={() => window.dispatchEvent(new CustomEvent('new-ticket'))}
					class="focus-ring flex h-7 items-center gap-1.5 rounded-full bg-[var(--accent-solid)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-solid-hover)]"
				>
					<Plus size={14} /> New ticket
				</button>
			{/if}
		{/snippet}
	</ViewHeader>

	{#if cols.length === 0}
		<div class="flex flex-1 items-center justify-center p-6">
			<EmptyStateApp icon={InboxIcon} title="This board has no columns yet." body="Add a column to start tracking tickets, or check Triage for incoming ideas." action={canManage ? { label: 'Add column', onclick: addColumn } : undefined} />
		</div>
	{:else if !isWide.current && !mobileBoardMode}
		<div class="flex-1">
			<BoardListView columns={filteredCols} {canEdit} onopen={cardClick} oncreate={canEdit ? openCreate : undefined} />
		</div>
	{:else}
		{#if !isWide.current}
			<!-- Mobile board-mode pager — replaces the section tab row (chrome budget). -->
			<div class="hairline-b sticky top-0 z-20 flex h-9 items-center gap-1.5 overflow-x-auto bg-[var(--raised)] px-3 [scrollbar-width:none]">
				{#each cols as col (col.id)}
					<button type="button" onclick={() => scrollToColumn(col.id)} class="data-mono flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-[var(--ot-hairline)] px-2 text-neutral-500 dark:text-neutral-400">
						<span class="size-1.5 shrink-0 rounded-full" style={`background:${col.color}`}></span>
						{col.name}
					</button>
				{/each}
			</div>
		{/if}

		<div class="relative min-h-0 flex-1">
			<div bind:this={scrollerEl} class="ot-scrollbar h-full overflow-x-auto [scrollbar-gutter:stable]">
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
							<!-- Ink well: a flat bordered tray the ticket cards sit inside — no soft card, hairline separation. -->
							<section bind:this={colRefs[col.id]} class="group/col relative flex h-full min-h-0 w-64 max-md:w-[88vw] max-md:shrink-0 max-md:snap-start flex-col rounded-[4px] border border-[var(--rule)] bg-[var(--ground)]">
									<div
										bind:this={scrollEls[col.id]}
										class="ot-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-gutter:stable]"
									>
										<div class={cn('sticky top-0 z-10 flex h-10 shrink-0 items-center justify-between gap-2 rounded-t-[4px] border-b border-[var(--rule)] px-3', over ? 'bg-[color-mix(in_srgb,var(--amber)_14%,var(--raised))]' : 'bg-[var(--raised)]')}>
											<div class="flex min-w-0 items-center gap-2">
												<ColumnIcon icon={col.icon} color={col.color} />
												<span class="mono-display truncate text-[13px] tracking-tight text-[var(--text)]">{col.name}</span>
												<span class={cn('data-mono', over ? 'font-bold text-[var(--amber)]' : 'text-[var(--dim)]')}>
													{items.length}{col.wipLimit != null ? `/${col.wipLimit}` : ''}
												</span>
											</div>
											<div class="flex items-center gap-0.5">
												{#if canEdit}
													<button onclick={() => openCreate(col.id)} class={iconBtn} aria-label={`New ticket in ${col.name}`} title="New ticket"><Plus size={14} /></button>
												{/if}
												{#if canManage}
													<button use:dragHandle class={cn(iconBtn, 'cursor-grab active:cursor-grabbing')} aria-label="Drag to reorder column"><GripVertical size={14} /></button>
													<Popover placement="bottom-end" class="w-72 p-3">
														{#snippet trigger(tp)}
															<button type="button" {...tp} class={iconBtn} aria-label="Column settings"><Settings2 size={14} /></button>
														{/snippet}
														{#snippet content()}
															{@render columnSettings(col)}
														{/snippet}
													</Popover>
												{/if}
											</div>
										</div>

										{#if composerCol === col.id}
											<div class="px-2 pt-2">
												<!-- svelte-ignore a11y_autofocus -->
												<textarea
													bind:value={composerText}
													autofocus
													placeholder="Ticket title…"
													onkeydown={(e) => {
														if (e.key === 'Enter' && !e.shiftKey) {
															e.preventDefault();
															createTicket(col);
														}
														if (e.key === 'Escape') {
															composerCol = null;
															composerText = '';
														}
													}}
													class="focus-ring w-full resize-none rounded-xl border border-neutral-200 bg-white p-2.5 text-sm dark:border-neutral-800 dark:bg-neutral-800"
													rows="2"
												></textarea>
											</div>
										{/if}

										<div
											class="flex flex-col gap-2 px-2 py-2"
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
												<!-- svelte-ignore a11y_no_static_element_interactions -->
												<div class="shrink-0" onpointerdown={onCardPointerDown}>
													<div class={selectMode && selectedIds.includes(item.id) ? 'rounded-xl ring-2 ring-[var(--accent-solid)] ring-offset-1 dark:ring-offset-neutral-800' : ''}>
														<Card ticket={item} onopen={cardClick} dragDisabled={dragPaused} flash={item.id === flashId} />
													</div>
												</div>
											{/each}
										</div>

										<!-- Permanent dashed empty/new-ticket slot — never hover-gated. -->
										{#if canEdit}
											<div class="px-2 pb-2">
												<button
													onclick={() => openCreate(col.id)}
													class="focus-ring flex h-16 w-full shrink-0 items-center justify-center gap-1.5 rounded-[4px] border border-dashed border-[var(--rule)] text-xs font-medium text-[var(--dim)] transition-colors hover:border-[var(--accent-border)] hover:text-[var(--accent)]"
												>
													<Plus size={14} /> New ticket
												</button>
											</div>
										{/if}
									</div>
								{#if vOverflow[col.id]}<GradualBlur side="bottom" size={28} class="rounded-b-[4px]" />{/if}
							</section>
						{/each}
					</section>

					{#if canManage}
						<button onclick={addColumn} class="focus-ring mt-0 flex w-64 shrink-0 items-center justify-center gap-2 rounded-[4px] border border-dashed border-[var(--rule)] px-3 py-2.5 text-sm font-medium text-[var(--dim)] transition-colors hover:border-[var(--accent-border)] hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)] hover:text-[var(--accent)]">
							<Plus size={15} /> Add column
						</button>
					{/if}
				</div>
			</div>
			{#if hOverflow}<GradualBlur side="right" size={32} />{/if}
		</div>
	{/if}
</div>

{#if selectMode && selectedIds.length}
	<div class="fixed inset-x-2 bottom-4 z-40 flex max-w-[calc(100vw-1rem)] flex-wrap items-center justify-center gap-2 rounded-[6px] border border-[var(--rule)] bg-[var(--raised)] px-3 py-2 sm:inset-x-auto sm:left-1/2 sm:max-w-none sm:-translate-x-1/2 sm:flex-nowrap">
		<span class="px-1 text-sm font-medium text-[var(--text)]"><span class="data-mono text-[var(--accent)]">{selectedIds.length}</span> selected</span>
		<div class="w-32">
			<Select bind:value={bulkMoveVal} options={bulkColumnOptions} placeholder="Move to…" size="sm" onchange={(v) => { if (v) bulkAction('move', { columnId: v }); bulkMoveVal = ''; }} />
		</div>
		<div class="w-32">
			<Select bind:value={bulkLabelVal} options={bulkLabelOptions} placeholder="Add label…" size="sm" onchange={(v) => { if (v) bulkAction('label', { labelId: v }); bulkLabelVal = ''; }} />
		</div>
		<div class="w-32">
			<Select bind:value={bulkAssignVal} options={bulkMemberOptions} placeholder="Assign…" size="sm" onchange={(v) => { if (v) bulkAction('assign', { userId: v }); bulkAssignVal = ''; }} />
		</div>
		{#if canManage}
			<button onclick={() => bulkAction('delete')} class="focus-ring flex h-7 items-center gap-1 rounded-full px-2.5 text-sm text-red-600 transition-colors hover:bg-red-500/10 dark:hover:bg-red-500/10"><Trash2 size={14} /> Delete</button>
		{/if}
		<button onclick={() => (selectedIds = [])} class="focus-ring h-7 rounded-full px-2.5 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">Clear</button>
	</div>
{/if}

{#if selectedTicket}
	<TicketPeek
		ticketId={selectedTicket}
		{boardId}
		{projectId}
		{labels}
		{columns}
		{currentUser}
		presentation={fullView ? 'full' : 'peek'}
		ontogglefull={toggleFull}
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
