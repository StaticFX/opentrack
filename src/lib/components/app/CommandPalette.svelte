<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		Search,
		LayoutDashboard,
		Bell,
		UserRound,
		Shield,
		Plus,
		Hash,
		Folder,
		Ticket,
		CircleUser,
		CornerDownLeft,
		SquareKanban,
		History
	} from '@lucide/svelte';
	import { announce } from '$lib/announce';
	import Kbd from '$lib/components/ui/Kbd.svelte';

	type WsRef = { id: string; slug: string; name: string };
	type ProjRef = { slug: string; name: string; color?: string | null };
	type Item = {
		id: string;
		label: string;
		sub?: string;
		icon: typeof Search;
		group: string;
		run: () => void;
	};
	type Recent = { href: string; label: string; type: 'project' | 'board'; ts: number };

	let open = $state(false);
	let q = $state('');
	let sel = $state(0);
	let loading = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLDivElement | null>(null);
	let remote = $state<Item[]>([]);
	let recents = $state<Recent[]>([]);
	let reqId = 0;
	let restoreFocus: HTMLElement | null = null;

	const pd = $derived(page.data as Record<string, unknown>);
	const user = $derived(pd.user as { isAdmin: boolean } | undefined);
	const workspaces = $derived((pd.workspaces ?? []) as WsRef[]);
	const currentWs = $derived(pd.workspace as WsRef | undefined);
	const projects = $derived((pd.projects ?? []) as ProjRef[]);
	const canCreateProject = $derived(Boolean(pd.canCreateProject));
	// Present on a board route; enables the "New ticket" command.
	const onBoard = $derived(Boolean(pd.board) && Boolean(pd.canEditContent));

	function close() {
		open = false;
		q = '';
		remote = [];
		sel = 0;
		restoreFocus?.focus?.();
		restoreFocus = null;
	}
	async function show() {
		restoreFocus = document.activeElement as HTMLElement | null;
		open = true;
		q = '';
		remote = [];
		sel = 0;
		try {
			const raw = JSON.parse(localStorage.getItem('ot-recents') ?? '[]');
			recents = Array.isArray(raw) ? raw.slice(0, 6) : [];
		} catch {
			recents = [];
		}
		await tick();
		inputEl?.focus();
	}
	function nav(href: string) {
		close();
		goto(href);
	}

	// Last-visited projects/boards (recorded by the app layout) lead the
	// zero-query state.
	const recentItems = $derived.by<Item[]>(() =>
		recents.map((r) => ({
			id: `recent-${r.href}`,
			label: r.label,
			sub: r.type,
			icon: r.type === 'board' ? SquareKanban : History,
			group: 'Recent',
			run: () => nav(r.href)
		}))
	);

	// Static + navigation commands, always available (filtered client-side).
	const staticItems = $derived.by<Item[]>(() => {
		const items: Item[] = [
			{ id: 'go-dashboard', label: 'Home', icon: LayoutDashboard, group: 'Go to', run: () => nav('/dashboard') },
			{ id: 'go-my', label: 'My Work', icon: CircleUser, group: 'Go to', run: () => nav('/my') },
			{ id: 'go-inbox', label: 'Inbox', icon: Bell, group: 'Go to', run: () => nav('/inbox') },
			{ id: 'go-account', label: 'Account', icon: UserRound, group: 'Go to', run: () => nav('/account') }
		];
		if (user?.isAdmin) items.push({ id: 'go-admin', label: 'Admin', icon: Shield, group: 'Go to', run: () => nav('/admin') });
		if (onBoard)
			items.push({ id: 'new-ticket', label: 'New ticket', icon: Ticket, group: 'Create', run: () => { close(); window.dispatchEvent(new CustomEvent('new-ticket')); } });
		items.push({ id: 'new-ws', label: 'New workspace', icon: Plus, group: 'Create', run: () => nav('/w/new') });
		if (canCreateProject && currentWs)
			items.push({ id: 'new-proj', label: 'New project', sub: currentWs.name, icon: Plus, group: 'Create', run: () => nav(`/w/${currentWs.slug}/p/new`) });
		for (const ws of workspaces)
			items.push({ id: `ws-${ws.id}`, label: ws.name, icon: Hash, group: 'Workspaces', run: () => nav(`/w/${ws.slug}`) });
		if (currentWs)
			for (const p of projects)
				items.push({ id: `proj-${p.slug}`, label: p.name, sub: currentWs.name, icon: Folder, group: 'Projects', run: () => nav(`/w/${currentWs.slug}/p/${p.slug}`) });
		return items;
	});

	const filteredStatic = $derived.by(() => {
		const term = q.trim().toLowerCase();
		if (!term) return staticItems;
		return staticItems.filter((i) => (i.label + ' ' + (i.sub ?? '')).toLowerCase().includes(term));
	});

	const results = $derived(
		q.trim() ? [...filteredStatic, ...remote] : [...recentItems, ...staticItems]
	);

	// Group the flat result list for rendering, preserving order.
	const grouped = $derived.by(() => {
		const out: { group: string; items: Item[] }[] = [];
		for (const it of results) {
			let g = out.find((x) => x.group === it.group);
			if (!g) { g = { group: it.group, items: [] }; out.push(g); }
			g.items.push(it);
		}
		return out;
	});

	// Flat index → item, for keyboard selection.
	function activate(i: number) {
		results[i]?.run();
	}

	// Debounced remote search. Ticket hits land on the INTERNAL ticket route,
	// which redirects members onto the board with the peek open.
	$effect(() => {
		const term = q.trim();
		if (!term) { remote = []; loading = false; return; }
		const id = ++reqId;
		loading = true;
		const t = setTimeout(async () => {
			try {
				const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
				if (!res.ok || id !== reqId) return;
				const d = await res.json();
				const items: Item[] = [];
				for (const p of d.projects ?? [])
					items.push({ id: `s-proj-${p.wsSlug}-${p.slug}`, label: p.name, sub: `${p.wsSlug} · project`, icon: Folder, group: 'Projects', run: () => nav(`/w/${p.wsSlug}/p/${p.slug}`) });
				for (const t of d.tickets ?? [])
					items.push({ id: `s-tk-${t.wsSlug}-${t.slug}-${t.number}`, label: `#${t.number} ${t.title}`, sub: t.closed ? 'closed' : `${t.slug}`, icon: Ticket, group: 'Tickets', run: () => nav(`/w/${t.wsSlug}/p/${t.slug}/t/${t.number}`) });
				if (id === reqId) {
					remote = items;
					announce(`${items.length} search ${items.length === 1 ? 'result' : 'results'}`);
				}
			} catch {
				/* ignore */
			} finally {
				if (id === reqId) loading = false;
			}
		}, 150);
		return () => clearTimeout(t);
	});

	// Keep selection in range as results change.
	$effect(() => {
		if (sel >= results.length) sel = Math.max(0, results.length - 1);
	});

	// Keep the keyboard selection visible in the scrollable list.
	$effect(() => {
		const target = results[sel];
		if (!open || !target || !listEl) return;
		document.getElementById(`cp-${target.id}`)?.scrollIntoView({ block: 'nearest' });
	});

	function onKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			open ? close() : show();
			return;
		}
		if (!open) return;
		if (e.key === 'Escape') { e.preventDefault(); close(); }
		else if (e.key === 'Tab') {
			// Focus stays in the input; the list is driven via aria-activedescendant.
			e.preventDefault();
			inputEl?.focus();
		}
		else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, results.length - 1); }
		else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); }
		else if (e.key === 'Enter') { e.preventDefault(); activate(sel); }
	}

	onMount(() => {
		const openEvt = () => show();
		window.addEventListener('keydown', onKeydown);
		window.addEventListener('command-palette', openEvt);
		return () => {
			window.removeEventListener('keydown', onKeydown);
			window.removeEventListener('command-palette', openEvt);
		};
	});
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
		<button aria-label="Close" class="absolute inset-0 bg-neutral-950/60 backdrop-blur-[2px]" onclick={close}></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Search"
			class="ot-palette-panel relative w-full max-w-xl overflow-hidden rounded-[6px] border border-[var(--rule)] bg-[var(--raised)]"
		>
			<div class="flex items-center gap-2 border-b border-[var(--rule)] px-3">
				<Search size={16} class="shrink-0 text-[var(--faint)]" />
				<input
					bind:this={inputEl}
					bind:value={q}
					placeholder="Search projects, tickets, or jump to…"
					role="combobox"
					aria-expanded="true"
					aria-controls="app-palette-list"
					aria-activedescendant={results[sel] ? `cp-${results[sel].id}` : undefined}
					class="h-12 w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--faint)]"
				/>
				{#if loading}
					<span class="flex shrink-0 gap-0.5" aria-hidden="true">
						{#each [0, 1, 2] as i (i)}
							<span class="size-1 animate-pulse rounded-full bg-[var(--faint)] motion-reduce:animate-none" style={`animation-delay:${i * 150}ms`}></span>
						{/each}
					</span>
				{/if}
				<Kbd keys={['esc']} class="hidden shrink-0 sm:flex" />
			</div>

			<div bind:this={listEl} id="app-palette-list" role="listbox" class="mono-scroll max-h-[50vh] overflow-y-auto p-1.5">
				{#if results.length === 0}
					<p class="px-3 py-8 text-center text-[13px] text-[var(--dim)]">No matches.</p>
				{:else}
					{#each grouped as g (g.group)}
						<div class="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-[var(--faint)] uppercase" role="presentation">{g.group}</div>
						{#each g.items as it (it.id)}
							{@const idx = results.indexOf(it)}
							{@const Icon = it.icon}
							<button
								id={`cp-${it.id}`}
								role="option"
								tabindex={-1}
								aria-selected={idx === sel}
								onclick={it.run}
								onmousemove={() => (sel = idx)}
								class={`flex w-full items-center gap-2.5 rounded-[3px] px-2.5 py-2 text-left text-[13px] ${idx === sel ? 'bg-[var(--accent-soft)] text-[var(--accent-fg)]' : 'text-[var(--text)] hover:bg-white/5'}`}
							>
								<Icon size={15} class={`shrink-0 ${idx === sel ? 'text-[var(--accent-fg)]' : 'text-[var(--faint)]'}`} />
								<span class="min-w-0 flex-1 truncate">{it.label}</span>
								{#if it.sub}<span class="data-mono shrink-0 truncate text-[var(--faint)]">{it.sub}</span>{/if}
								{#if idx === sel}<CornerDownLeft size={13} class="shrink-0 text-[var(--accent-fg)]" />{/if}
							</button>
						{/each}
					{/each}
					<p class="data-mono px-2 pt-2 pb-1 text-right text-[var(--faint)]" role="presentation">↑↓ navigate · ↵ open · esc close</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.ot-palette-panel {
		animation: ot-palette-in 120ms var(--ease-out-quint);
	}
	@keyframes ot-palette-in {
		from {
			opacity: 0;
			transform: scale(0.98);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ot-palette-panel {
			animation: none;
		}
	}
</style>
