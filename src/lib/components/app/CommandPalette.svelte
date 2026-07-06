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
		CornerDownLeft
	} from '@lucide/svelte';

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

	let open = $state(false);
	let q = $state('');
	let sel = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);
	let remote = $state<Item[]>([]);
	let reqId = 0;

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
	}
	async function show() {
		open = true;
		q = '';
		remote = [];
		sel = 0;
		await tick();
		inputEl?.focus();
	}
	function nav(href: string) {
		close();
		goto(href);
	}

	// Static + navigation commands, always available (filtered client-side).
	const staticItems = $derived.by<Item[]>(() => {
		const items: Item[] = [
			{ id: 'go-dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Go to', run: () => nav('/dashboard') },
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

	const results = $derived([...filteredStatic, ...remote]);

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

	// Debounced remote search.
	$effect(() => {
		const term = q.trim();
		if (!term) { remote = []; return; }
		const id = ++reqId;
		const t = setTimeout(async () => {
			try {
				const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
				if (!res.ok || id !== reqId) return;
				const d = await res.json();
				const items: Item[] = [];
				for (const p of d.projects ?? [])
					items.push({ id: `s-proj-${p.wsSlug}-${p.slug}`, label: p.name, sub: `${p.wsSlug} · project`, icon: Folder, group: 'Projects', run: () => nav(`/w/${p.wsSlug}/p/${p.slug}`) });
				for (const t of d.tickets ?? [])
					items.push({ id: `s-tk-${t.wsSlug}-${t.slug}-${t.number}`, label: `#${t.number} ${t.title}`, sub: t.closed ? 'closed' : `${t.slug}`, icon: Ticket, group: 'Tickets', run: () => nav(`/${t.wsSlug}/${t.slug}/t/${t.number}`) });
				if (id === reqId) remote = items;
			} catch {
				/* ignore */
			}
		}, 150);
		return () => clearTimeout(t);
	});

	// Keep selection in range as results change.
	$effect(() => {
		if (sel >= results.length) sel = Math.max(0, results.length - 1);
	});

	function onKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			open ? close() : show();
			return;
		}
		if (!open) return;
		if (e.key === 'Escape') { e.preventDefault(); close(); }
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
		<button aria-label="Close" class="absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px]" onclick={close}></button>
		<div class="relative w-full max-w-xl overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
			<div class="flex items-center gap-2 border-b border-neutral-100 px-3 dark:border-neutral-800">
				<Search size={16} class="shrink-0 text-neutral-400" />
				<input
					bind:this={inputEl}
					bind:value={q}
					placeholder="Search projects, tickets, or jump to…"
					class="h-12 w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
				/>
				<kbd class="hidden shrink-0 rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-400 sm:block dark:border-neutral-700">esc</kbd>
			</div>

			<div class="max-h-[50vh] overflow-y-auto p-1.5">
				{#if results.length === 0}
					<p class="px-3 py-8 text-center text-sm text-neutral-400">No matches.</p>
				{:else}
					{#each grouped as g (g.group)}
						<div class="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">{g.group}</div>
						{#each g.items as it (it.id)}
							{@const idx = results.indexOf(it)}
							{@const Icon = it.icon}
							<button
								onclick={it.run}
								onmousemove={() => (sel = idx)}
								class={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm ${idx === sel ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
							>
								<Icon size={15} class="shrink-0 text-neutral-400" />
								<span class="min-w-0 flex-1 truncate">{it.label}</span>
								{#if it.sub}<span class="shrink-0 truncate text-xs text-neutral-400">{it.sub}</span>{/if}
								{#if idx === sel}<CornerDownLeft size={13} class="shrink-0 text-neutral-400" />{/if}
							</button>
						{/each}
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}
