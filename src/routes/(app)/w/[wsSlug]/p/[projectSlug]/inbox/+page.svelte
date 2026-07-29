<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { MediaQuery } from 'svelte/reactivity';
	import { prefersReducedMotion } from 'svelte/motion';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		Archive,
		ArchiveRestore,
		Check,
		ChevronUp,
		ExternalLink,
		Inbox,
		MessageSquare,
		Ticket,
		X
	} from '@lucide/svelte';
	import { SUGGESTION_KINDS, type SuggestionStatus } from '$lib/constants';
	import { SUGGESTION_STATUS_META } from '$lib/suggestionStatus';
	import { SUGGESTION_KIND_META } from '$lib/suggestionKind';
	import { renderMarkdown } from '$lib/markdown';
	import { announce } from '$lib/announce';
	import { toast } from '$lib/toast';
	import { cn } from '$lib/utils/cn';
	import ViewHeader from '$lib/components/app/ViewHeader.svelte';
	import Tabs, { type TabItem } from '$lib/components/ui/Tabs.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Kbd from '$lib/components/ui/Kbd.svelte';
	import TimeAgo from '$lib/components/ui/TimeAgo.svelte';
	import EmptyStateApp from '$lib/components/ui/EmptyStateApp.svelte';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);

	// Split-pane ≥lg, list + full-screen Sheet detail below it.
	const desktop = new MediaQuery('(min-width: 1024px)');

	const base = $derived(`/w/${data.wsSlug}/p/${data.projectSlug}/inbox`);
	const publicUrl = $derived(`/${data.wsSlug}/${data.projectSlug}/suggestions`);

	const tabs: TabItem[] = $derived([
		{ key: 'triage', label: 'Needs triage', count: data.counts.open },
		{ key: 'accepted', label: 'Accepted', count: data.counts.accepted },
		{ key: 'declined', label: 'Declined', count: data.counts.declined },
		{ key: 'converted', label: 'Converted', count: data.counts.converted },
		{ key: 'all', label: 'All', count: data.counts.all },
		{ key: 'archived', label: 'Archived', count: data.counts.archived }
	]);
	const sortOptions = [
		{ value: 'top', label: 'Top' },
		{ value: 'new', label: 'New' },
		{ value: 'trending', label: 'Trending' }
	];
	const kindOptions = [
		{ value: '', label: 'All kinds' },
		...SUGGESTION_KINDS.map((k) => ({ value: k, label: `${SUGGESTION_KIND_META[k].label}s` }))
	];

	// Existing view|sort|kind contract — preserved verbatim (params merge, others clear on empty).
	function go(params: Record<string, string>) {
		const sp = new URLSearchParams({ view: data.view, sort: data.sort });
		if (data.kind) sp.set('kind', data.kind);
		for (const [k, v] of Object.entries(params)) {
			if (v) sp.set(k, v);
			else sp.delete(k);
		}
		goto(`${base}?${sp}`, { noScroll: true });
	}

	const STATUS_TONE: Record<SuggestionStatus, 'neutral' | 'green' | 'red'> = {
		open: 'neutral',
		accepted: 'green',
		declined: 'red',
		// No teal tone exists — converted folds into the same "resolved" green as accepted.
		duplicate: 'neutral',
		converted: 'green'
	};

	// ── Selection (`?sel=`, replaceState — never pollutes Back) ───────────────
	const rawSel = page.url.searchParams.get('sel');
	const hasValidInitialSel = rawSel != null && data.suggestions.some((s) => s.id === rawSel);

	let selectedId = $state<string | null>(hasValidInitialSel ? rawSel : (data.suggestions[0]?.id ?? null));
	let mobileSheetOpen = $state(hasValidInitialSel);
	let exitingId = $state<string | null>(null);

	const selected = $derived(data.suggestions.find((s) => s.id === selectedId) ?? null);

	// Keep selection valid as the list changes (tab/sort/kind switch, or an item
	// leaving the current view after an action).
	$effect(() => {
		if (data.suggestions.length === 0) {
			if (selectedId !== null) selectedId = null;
			return;
		}
		if (!data.suggestions.some((s) => s.id === selectedId)) {
			selectedId = data.suggestions[0].id;
		}
	});
	$effect(() => {
		const url = new URL(page.url);
		const current = url.searchParams.get('sel');
		if (selectedId) {
			if (current === selectedId) return;
			url.searchParams.set('sel', selectedId);
		} else {
			if (current === null) return;
			url.searchParams.delete('sel');
		}
		replaceState(url, {});
	});
	$effect(() => {
		if (!desktop.current && mobileSheetOpen && !selected) mobileSheetOpen = false;
	});

	function selectRow(id: string) {
		selectedId = id;
		if (!desktop.current) mobileSheetOpen = true;
	}
	function selectDelta(delta: number) {
		if (data.suggestions.length === 0) return;
		const idx = data.suggestions.findIndex((s) => s.id === selectedId);
		const next = data.suggestions[(idx === -1 ? 0 : idx) + delta];
		if (next) selectedId = next.id;
	}

	// ── Pinned action bar: the four existing forms, rendered once ─────────────
	let note = $state('');
	// Notes don't carry over between items.
	$effect(() => {
		selectedId;
		note = '';
	});
	type ActionKind = 'convert' | 'accept' | 'decline' | 'archive' | 'unarchive';
	let pending = $state<ActionKind | null>(null);

	let convertFormEl = $state<HTMLFormElement>();
	let acceptFormEl = $state<HTMLFormElement>();
	let declineFormEl = $state<HTMLFormElement>();
	let archiveFormEl = $state<HTMLFormElement>();
	let unarchiveFormEl = $state<HTMLFormElement>();

	const ACTION_MESSAGE: Record<ActionKind, (title: string) => string> = {
		convert: (t) => `Converted "${t}" to a ticket.`,
		accept: (t) => `Accepted "${t}".`,
		decline: (t) => `Declined "${t}".`,
		archive: (t) => `Archived "${t}".`,
		unarchive: (t) => `Restored "${t}".`
	};

	async function undoArchive(id: string) {
		const fd = new FormData();
		fd.set('id', id);
		const res = await fetch(`${base}?/unarchive`, {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true' },
			body: fd
		});
		if (res.ok) {
			await invalidateAll();
			selectedId = id;
		} else {
			toast('Could not restore suggestion.', { tone: 'error' });
		}
	}

	// Every successful action removes the acted-on item from the current view,
	// so exit + auto-advance is the one code path shared by all five forms.
	function makeEnhance(kind: ActionKind): SubmitFunction {
		return () => {
			const acted = selected;
			pending = kind;
			return async ({ result, update }) => {
				pending = null;
				if (result.type === 'success' && acted) {
					if (kind === 'accept' || kind === 'decline') note = '';
					const idx = data.suggestions.findIndex((s) => s.id === acted.id);
					const nextItem = data.suggestions[idx + 1] ?? data.suggestions[idx - 1] ?? null;
					exitingId = acted.id;
					selectedId = nextItem?.id ?? null;
					announce(ACTION_MESSAGE[kind](acted.title));
					if (kind === 'archive') {
						toast.undo('Archived suggestion', () => undoArchive(acted.id));
					}
					// Keep the row collapsed through the refetch so it never "pops"
					// back to full height right before disappearing from the list.
					await new Promise((r) => setTimeout(r, prefersReducedMotion.current ? 0 : 250));
				}
				await update();
				exitingId = null;
			};
		};
	}
	const enhanceConvert = makeEnhance('convert');
	const enhanceAccept = makeEnhance('accept');
	const enhanceDecline = makeEnhance('decline');
	const enhanceArchive = makeEnhance('archive');
	const enhanceUnarchive = makeEnhance('unarchive');

	const isEditable = (el: EventTarget | null) => {
		const n = el as HTMLElement | null;
		if (!n) return false;
		return n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.isContentEditable;
	};
	function onWindowKeydown(e: KeyboardEvent) {
		if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isEditable(e.target)) return;
		if (!selected) return;
		switch (e.key.toLowerCase()) {
			case 'j':
				e.preventDefault();
				selectDelta(1);
				break;
			case 'k':
				e.preventDefault();
				selectDelta(-1);
				break;
			case 'c':
				if (!selected.archived && selected.status !== 'converted') {
					e.preventDefault();
					convertFormEl?.requestSubmit();
				}
				break;
			case 'a':
				if (!selected.archived && selected.status !== 'accepted') {
					e.preventDefault();
					acceptFormEl?.requestSubmit();
				}
				break;
			case 'd':
				if (!selected.archived && selected.status !== 'declined') {
					e.preventDefault();
					declineFormEl?.requestSubmit();
				}
				break;
			case 'e':
				if (!selected.archived) {
					e.preventDefault();
					archiveFormEl?.requestSubmit();
				}
				break;
		}
	}

	const emptyCopy = $derived.by(() => {
		switch (data.view) {
			case 'triage':
				return { title: 'Nothing waiting. New feedback lands here.', link: true };
			case 'archived':
				return { title: 'No archived items.', link: false };
			case 'accepted':
				return { title: 'No accepted items yet.', link: false };
			case 'declined':
				return { title: 'No declined items yet.', link: false };
			case 'converted':
				return { title: 'No converted items yet.', link: false };
			default:
				return { title: 'No suggestions match.', link: false };
		}
	});
</script>

<svelte:head><title>Triage · {data.project.name} · OpenTrack</title></svelte:head>

<svelte:window onkeydown={onWindowKeydown} />

<div class="flex h-full min-h-0 flex-col">
	<ViewHeader
		crumbs={[
			{
				label: data.project.name,
				dot: data.project.color || 'var(--accent-solid)',
				menu: (data.projects ?? []).map((p) => ({
					label: p.name,
					href: `/w/${data.wsSlug}/p/${p.slug}`,
					current: p.slug === data.projectSlug
				}))
			},
			{ label: 'Triage' }
		]}
		live={{ text: `${data.counts.open} waiting`, beat: true }}
	>
		{#snippet toolbar()}
			<Select value={data.sort} options={sortOptions} class="w-28" onchange={(v) => go({ sort: v })} />
			<Select value={data.kind ?? ''} options={kindOptions} class="w-32" onchange={(v) => go({ kind: v })} />
			<a
				href={publicUrl}
				target="_blank"
				rel="noreferrer"
				class="focus-ring flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] text-[var(--faint)] transition-colors hover:text-[var(--accent)]"
			>
				View public <ExternalLink size={12} aria-hidden="true" />
			</a>
		{/snippet}
		{#snippet chips()}
			<Tabs items={tabs} value={data.view} onchange={(v) => go({ view: v })} ariaLabel="Triage status" />
		{/snippet}
	</ViewHeader>

	<div class="flex min-h-0 flex-1 overflow-hidden">
		<div class={cn('min-h-0 overflow-y-auto', desktop.current ? 'hairline-r w-96 shrink-0' : 'w-full')}>
			{#each data.suggestions as s (s.id)}
				{@const kindMeta = SUGGESTION_KIND_META[s.kind]}
				<div
					class={cn(
						'overflow-hidden transition-[max-height,opacity] duration-[250ms] ease-[var(--ease-out-quint)] motion-reduce:transition-none',
						exitingId === s.id ? 'max-h-0 opacity-0' : 'max-h-14 opacity-100'
					)}
				>
					<button
						type="button"
						onclick={() => selectRow(s.id)}
						aria-current={selectedId === s.id ? 'true' : undefined}
						class={cn(
							'hairline-b focus-ring flex h-14 w-full items-center gap-3 px-3 text-left',
							selectedId === s.id
								? 'bg-[var(--accent-wash)]'
								: 'hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)]'
						)}
					>
						<span
							class={cn(
								'vote-mono data-mono h-6 w-11 shrink-0 justify-center rounded-[3px] border',
								selectedId === s.id ? 'border-[var(--accent)]' : 'border-[var(--rule)]'
							)}
						>
							<ChevronUp size={10} aria-hidden="true" />{s.votes}
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-[13px] font-medium text-[var(--text)]">{s.title}</span>
							<span class="data-mono mt-0.5 flex items-center gap-1.5 text-[var(--faint)]">
								<span class="size-1.5 shrink-0 rounded-full" style={`background:${kindMeta.color}`} aria-hidden="true"
								></span>
								<span>{kindMeta.label}</span>
								<span aria-hidden="true">·</span>
								<TimeAgo date={s.createdAt} />
							</span>
						</span>
					</button>
				</div>
			{:else}
				<div class="p-4">
					<EmptyStateApp
						icon={Inbox}
						title={emptyCopy.title}
						body={emptyCopy.link
							? 'Suggestions and bugs submitted on your public page land here for review.'
							: undefined}
						action={emptyCopy.link ? { label: 'View public page', href: publicUrl } : undefined}
					/>
				</div>
			{/each}
		</div>

		{#if desktop.current}
			<div class="min-h-0 flex-1 overflow-hidden">
				{@render detailContent()}
			</div>
		{/if}
	</div>
</div>

{#if !desktop.current}
	<Sheet
		bind:open={mobileSheetOpen}
		side="right"
		size="full"
		ariaLabel={selected ? selected.title : 'Triage detail'}
		class="flex flex-col overflow-hidden"
	>
		{@render detailContent()}
	</Sheet>
{/if}

{#snippet detailContent()}
	<div class="flex h-full min-h-0 flex-col">
		<div class="min-h-0 flex-1 overflow-y-auto p-5">
			{#if selected}
				{@const KindIcon = SUGGESTION_KIND_META[selected.kind].icon}
				<div class="flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--faint)]">
					<KindIcon size={13} style={`color:${SUGGESTION_KIND_META[selected.kind].color}`} aria-hidden="true" />
					<span>{SUGGESTION_KIND_META[selected.kind].label}</span>
					<span aria-hidden="true">·</span>
					<Badge tone={STATUS_TONE[selected.status]}>{SUGGESTION_STATUS_META[selected.status].label}</Badge>
					{#if selected.authorName}
						<span aria-hidden="true">·</span>
						<span>{selected.authorName}</span>
					{/if}
					<span aria-hidden="true">·</span>
					<TimeAgo date={selected.createdAt} />
					<span aria-hidden="true">·</span>
					<span class="vote-mono data-mono flex items-center gap-1"><ChevronUp size={11} aria-hidden="true" />{selected.votes}</span>
					{#if selected.comments > 0}
						<span aria-hidden="true">·</span>
						<span class="data-mono flex items-center gap-1"><MessageSquare size={11} aria-hidden="true" />{selected.comments}</span>
					{/if}
				</div>
				<h2 class="mono-display mt-2 text-lg leading-tight text-[var(--text)]">{selected.title}</h2>
				<a
					href={`${publicUrl}/${selected.id}`}
					target="_blank"
					rel="noreferrer"
					class="focus-ring mt-2 inline-flex items-center gap-1 rounded-md text-[13px] text-[var(--faint)] hover:text-[var(--accent)]"
				>
					Open public thread <ExternalLink size={12} aria-hidden="true" />
				</a>
				{#if selected.body}
					<div class="prose prose-sm prose-invert mt-4 max-w-none">{@html renderMarkdown(selected.body)}</div>
				{/if}
			{:else}
				<p class="text-[13px] text-[var(--faint)]">Nothing selected.</p>
			{/if}
		</div>

		{#if selected}
			<div class="hairline-t shrink-0 space-y-2 p-3">
				{#if !selected.archived}
					<Input
						aria-label="Note"
						placeholder="Optional decline/accept note…"
						bind:value={note}
						class="h-8 text-[13px]"
					/>
				{/if}

				<p class="text-[10px] font-medium tracking-[0.18em] text-[var(--faint)] uppercase">// Actions</p>
				<div class="flex flex-wrap items-center gap-1.5">
					{#if !selected.archived}
						{#if selected.status !== 'converted'}
							<form method="POST" action="?/convert" use:enhance={enhanceConvert} bind:this={convertFormEl} class="contents">
								<input type="hidden" name="id" value={selected.id} />
								<Button type="submit" size="sm" variant="accent" disabled={pending !== null} loading={pending === 'convert'}>
									<Ticket size={13} aria-hidden="true" /> Convert to ticket
								</Button>
							</form>
						{/if}
						{#if selected.status !== 'accepted'}
							<form method="POST" action="?/resolve" use:enhance={enhanceAccept} bind:this={acceptFormEl} class="contents">
								<input type="hidden" name="id" value={selected.id} />
								<input type="hidden" name="status" value="accepted" />
								<input type="hidden" name="note" value={note} />
								<Button type="submit" size="sm" disabled={pending !== null} loading={pending === 'accept'}>
									<Check size={13} aria-hidden="true" /> Accept
								</Button>
							</form>
						{/if}
						{#if selected.status !== 'declined'}
							<form method="POST" action="?/resolve" use:enhance={enhanceDecline} bind:this={declineFormEl} class="contents">
								<input type="hidden" name="id" value={selected.id} />
								<input type="hidden" name="status" value="declined" />
								<input type="hidden" name="note" value={note} />
								<Button type="submit" size="sm" variant="ghost" disabled={pending !== null} loading={pending === 'decline'}>
									<X size={13} aria-hidden="true" /> Decline
								</Button>
							</form>
						{/if}
						<form method="POST" action="?/archive" use:enhance={enhanceArchive} bind:this={archiveFormEl} class="contents">
							<input type="hidden" name="id" value={selected.id} />
							<Button type="submit" size="sm" variant="ghost" class="ml-auto" disabled={pending !== null} loading={pending === 'archive'}>
								<Archive size={13} aria-hidden="true" /> Archive
							</Button>
						</form>
					{:else}
						<form method="POST" action="?/unarchive" use:enhance={enhanceUnarchive} bind:this={unarchiveFormEl} class="contents">
							<input type="hidden" name="id" value={selected.id} />
							<Button type="submit" size="sm" disabled={pending !== null} loading={pending === 'unarchive'}>
								<ArchiveRestore size={13} aria-hidden="true" /> Restore
							</Button>
						</form>
					{/if}
				</div>

				{#if !selected.archived}
					<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
						<span class="flex items-center gap-2.5 text-[11px] text-[var(--faint)]">
							<span class="inline-flex items-center gap-1"><Kbd keys={['C']} /> Convert</span>
							<span class="inline-flex items-center gap-1"><Kbd keys={['A']} /> Accept</span>
							<span class="inline-flex items-center gap-1"><Kbd keys={['D']} /> Decline</span>
							<span class="inline-flex items-center gap-1"><Kbd keys={['E']} /> Archive</span>
						</span>
						{#if f?.error}<span class="text-[13px] font-medium text-[#f85149]">{f.error}</span>{/if}
					</div>
				{:else if f?.error}
					<p class="text-[13px] font-medium text-[#f85149]">{f.error}</p>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}
