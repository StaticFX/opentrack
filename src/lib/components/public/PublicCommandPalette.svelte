<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		Search,
		Activity,
		SquareKanban,
		Map,
		MessagesSquare,
		Tag,
		Ticket,
		Lightbulb,
		CornerDownLeft,
		Sparkles
	} from '@lucide/svelte';
	import { announce } from '$lib/announce';
	import { SUGGESTION_KIND_META } from '$lib/suggestionKind';
	import { SUGGESTION_STATUS_META } from '$lib/suggestionStatus';

	type Item = {
		id: string;
		label: string;
		sub?: string;
		icon: typeof Search;
		group: string;
		run: () => void;
	};
	type Props = {
		projectId: string;
		base: string;
		projectName: string;
		tabs: Array<{ href: string; label: string }>;
	};
	let { projectId, base, projectName, tabs }: Props = $props();

	let open = $state(false);
	let q = $state('');
	let sel = $state(0);
	let loading = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);
	let remote = $state<Item[]>([]);
	let reqId = 0;
	let restoreFocus: HTMLElement | null = null;

	const TAB_ICONS: Record<string, typeof Search> = {
		Overview: Activity,
		Board: SquareKanban,
		Roadmap: Map,
		Feedback: MessagesSquare,
		Releases: Tag
	};

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
		await tick();
		inputEl?.focus();
	}
	function nav(href: string) {
		close();
		goto(href);
	}

	const staticItems = $derived.by<Item[]>(() => [
		...tabs.map((t) => ({
			id: `go-${t.label}`,
			label: t.label,
			sub: projectName,
			icon: TAB_ICONS[t.label] ?? Search,
			group: 'Go to',
			run: () => nav(t.href)
		})),
		{
			id: 'share-feedback',
			label: 'Share feedback',
			sub: 'idea or bug report',
			icon: Lightbulb,
			group: 'Go to',
			run: () => nav(`${base}/suggestions#post`)
		}
	]);

	const filteredStatic = $derived.by(() => {
		const term = q.trim().toLowerCase();
		if (!term) return staticItems;
		return staticItems.filter((i) => (i.label + ' ' + (i.sub ?? '')).toLowerCase().includes(term));
	});

	const results = $derived([...filteredStatic, ...remote]);

	const grouped = $derived.by(() => {
		const out: { group: string; items: Item[] }[] = [];
		for (const it of results) {
			let g = out.find((x) => x.group === it.group);
			if (!g) {
				g = { group: it.group, items: [] };
				out.push(g);
			}
			g.items.push(it);
		}
		return out;
	});

	function activate(i: number) {
		results[i]?.run();
	}

	// Debounced public search (tickets + feedback), request-id guarded.
	$effect(() => {
		const term = q.trim();
		if (term.length < 2) {
			remote = [];
			loading = false;
			return;
		}
		const id = ++reqId;
		loading = true;
		const t = setTimeout(async () => {
			try {
				const res = await fetch(`/api/public/projects/${projectId}/search?q=${encodeURIComponent(term)}`);
				if (!res.ok || id !== reqId) return;
				const d = await res.json();
				const items: Item[] = [];
				for (const tk of d.tickets ?? [])
					items.push({
						id: `s-tk-${tk.number}`,
						label: `#${tk.number} ${tk.title}`,
						sub: tk.closed ? 'closed' : 'open',
						icon: Ticket,
						group: 'Tickets',
						run: () => nav(`${base}/t/${tk.number}`)
					});
				for (const s of d.suggestions ?? [])
					items.push({
						id: `s-sg-${s.id}`,
						label: s.title,
						sub: `▲ ${s.votes} · ${SUGGESTION_STATUS_META[s.status as keyof typeof SUGGESTION_STATUS_META]?.label ?? s.status}`,
						icon: SUGGESTION_KIND_META[s.kind as keyof typeof SUGGESTION_KIND_META]?.icon ?? Lightbulb,
						group: 'Feedback',
						run: () => nav(`${base}/suggestions/${s.id}`)
					});
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

	$effect(() => {
		if (sel >= results.length) sel = Math.max(0, results.length - 1);
	});

	const isEditable = (el: EventTarget | null) => {
		const n = el as HTMLElement | null;
		if (!n) return false;
		return n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.isContentEditable;
	};

	function onKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			open ? close() : show();
			return;
		}
		if (!open && e.key === '/' && !isEditable(e.target)) {
			e.preventDefault();
			show();
			return;
		}
		if (!open) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		} else if (e.key === 'Tab') {
			// Focus stays in the input; the list is driven via aria-activedescendant.
			e.preventDefault();
			inputEl?.focus();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			sel = Math.min(sel + 1, results.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			sel = Math.max(sel - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			activate(sel);
		}
	}

	onMount(() => {
		const openEvt = () => show();
		window.addEventListener('keydown', onKeydown);
		window.addEventListener('pub-palette', openEvt);
		return () => {
			window.removeEventListener('keydown', onKeydown);
			window.removeEventListener('pub-palette', openEvt);
		};
	});

	// Lock body scroll while the palette is open.
	$effect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	});
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-end justify-center sm:items-start sm:p-4 sm:pt-[12vh]">
		<button aria-label="Close search" class="absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px]" onclick={close}></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Search {projectName}"
			class="relative w-full max-w-xl overflow-hidden rounded-t-2xl border border-black/5 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:rounded-2xl dark:border-white/10 dark:bg-neutral-900"
		>
			<div class="flex items-center gap-2 border-b border-neutral-100 px-3 dark:border-neutral-800">
				<Search size={16} class="shrink-0 text-neutral-400" />
				<input
					bind:this={inputEl}
					bind:value={q}
					placeholder={`Search ${projectName}…`}
					role="combobox"
					aria-expanded="true"
					aria-controls="pub-palette-list"
					aria-activedescendant={results[sel] ? `pp-${results[sel].id}` : undefined}
					class="h-12 w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
				/>
				{#if loading}
					<span class="flex shrink-0 gap-0.5" aria-hidden="true">
						{#each [0, 1, 2] as i (i)}
							<span class="size-1 animate-pulse rounded-full bg-neutral-300 motion-reduce:animate-none dark:bg-neutral-600" style={`animation-delay:${i * 150}ms`}></span>
						{/each}
					</span>
				{/if}
				<kbd class="hidden shrink-0 rounded border border-neutral-200 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400 sm:block dark:border-neutral-700">esc</kbd>
			</div>

			<div id="pub-palette-list" role="listbox" class="max-h-[60vh] overflow-y-auto p-1.5 sm:max-h-[50vh]">
				{#if results.length === 0}
					<div class="px-3 py-8 text-center">
						<p class="text-sm text-neutral-500 dark:text-neutral-400">
							Nothing matched <span class="font-semibold">“{q.trim()}”</span>.
						</p>
						<button
							onclick={() => nav(`${base}/suggestions?title=${encodeURIComponent(q.trim())}#post`)}
							class="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-solid)] px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--accent-solid-hover)]"
						>
							<Sparkles size={14} /> Missing something? Post it as feedback
						</button>
					</div>
				{:else}
					{#each grouped as g (g.group)}
						<div class="pub-label px-2 pt-2 pb-1" role="presentation">{g.group}</div>
						{#each g.items as it (it.id)}
							{@const idx = results.indexOf(it)}
							{@const Icon = it.icon}
							<button
								id={`pp-${it.id}`}
								role="option"
								tabindex={-1}
								aria-selected={idx === sel}
								onclick={it.run}
								onmousemove={() => (sel = idx)}
								class={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${idx === sel ? 'bg-[var(--accent-soft)] text-[var(--accent-fg)]' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
							>
								<Icon size={15} class="shrink-0 text-neutral-400" />
								<span class="min-w-0 flex-1 truncate">{it.label}</span>
								{#if it.sub}<span class="shrink-0 truncate font-mono text-[11px] text-neutral-400">{it.sub}</span>{/if}
								{#if idx === sel}<CornerDownLeft size={13} class="shrink-0 text-neutral-400" />{/if}
							</button>
						{/each}
					{/each}
					<p class="px-2 pt-2 pb-1 text-right font-mono text-[10px] text-neutral-300 dark:text-neutral-600" role="presentation">↑↓ navigate · ↵ open · esc close</p>
				{/if}
			</div>
		</div>
	</div>
{/if}
