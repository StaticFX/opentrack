<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import {
		Inbox,
		Check,
		X,
		Ticket,
		Archive,
		ArchiveRestore,
		ExternalLink,
		MessageSquare,
		ChevronUp
	} from '@lucide/svelte';
	import { SUGGESTION_KINDS } from '$lib/constants';
	import { SUGGESTION_STATUS_META } from '$lib/suggestionStatus';
	import { SUGGESTION_KIND_META } from '$lib/suggestionKind';
	import Button from '$lib/components/ui/Button.svelte';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);

	const base = $derived(`/w/${data.wsSlug}/p/${data.projectSlug}/inbox`);
	const publicUrl = $derived(`/${data.wsSlug}/${data.projectSlug}/suggestions`);

	const tabs = $derived([
		{ key: 'triage', label: 'Needs triage', count: data.counts.open },
		{ key: 'accepted', label: 'Accepted', count: data.counts.accepted },
		{ key: 'declined', label: 'Declined', count: data.counts.declined },
		{ key: 'converted', label: 'Converted', count: data.counts.converted },
		{ key: 'all', label: 'All', count: data.counts.all },
		{ key: 'archived', label: 'Archived', count: data.counts.archived }
	]);
	const sorts = [
		{ key: 'top', label: 'Top' },
		{ key: 'new', label: 'New' },
		{ key: 'trending', label: 'Trending' }
	];
	const kindFilters = [
		{ key: '', label: 'All types' },
		...SUGGESTION_KINDS.map((k) => ({ key: k, label: `${SUGGESTION_KIND_META[k].label}s` }))
	];

	function go(params: Record<string, string>) {
		const sp = new URLSearchParams({ view: data.view, sort: data.sort });
		if (data.kind) sp.set('kind', data.kind);
		for (const [k, v] of Object.entries(params)) {
			if (v) sp.set(k, v);
			else sp.delete(k);
		}
		goto(`${base}?${sp}`, { noScroll: true });
	}

	function ago(d: string | Date): string {
		const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
		if (s < 60) return 'just now';
		const m = Math.floor(s / 60);
		if (m < 60) return `${m}m ago`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h ago`;
		const days = Math.floor(h / 24);
		if (days < 30) return `${days}d ago`;
		return new Date(d).toLocaleDateString();
	}
</script>

<svelte:head><title>Inbox · {data.project.name}</title></svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
	<header class="mb-6 flex items-start justify-between gap-3">
		<div>
			<h1 class="flex items-center gap-2 text-xl font-semibold tracking-tight"><Inbox size={20} /> Inbox</h1>
			<p class="mt-0.5 text-sm text-neutral-500">Triage feedback coming in from your public page — accept, convert to a ticket, decline, or archive.</p>
		</div>
		<a href={publicUrl} target="_blank" rel="noreferrer" class="mt-1 flex shrink-0 items-center gap-1 text-xs text-brand-600 hover:underline">
			View public page <ExternalLink size={12} />
		</a>
	</header>

	{#if f?.error}
		<p class="mb-4 rounded-lg bg-red-50 p-2.5 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">{f.error}</p>
	{/if}

	<!-- Tabs -->
	<div class="mb-3 flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-800">
		{#each tabs as t (t.key)}
			<button
				onclick={() => go({ view: t.key })}
				class="-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors {data.view === t.key
					? 'border-brand-500 text-neutral-900 dark:text-neutral-100'
					: 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}"
			>
				{t.label}
				{#if t.count > 0}
					<span class="rounded-full bg-neutral-100 px-1.5 text-[11px] tabular-nums text-neutral-500 dark:bg-neutral-800">{t.count}</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Type filter + sort -->
	<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
		<div class="flex gap-1">
			{#each kindFilters as k (k.key)}
				<button
					onclick={() => go({ kind: k.key })}
					class="rounded-md px-2.5 py-0.5 text-xs font-medium {(data.kind ?? '') === k.key
						? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
						: 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}"
				>{k.label}</button>
			{/each}
		</div>
		<div class="flex gap-1">
			{#each sorts as s (s.key)}
				<button
					onclick={() => go({ sort: s.key })}
					class="rounded-md px-2 py-0.5 text-xs font-medium {data.sort === s.key
						? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
						: 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}"
				>{s.label}</button>
			{/each}
		</div>
	</div>

	<!-- List -->
	<div class="space-y-2">
		{#each data.suggestions as s (s.id)}
			{@const kindMeta = SUGGESTION_KIND_META[s.kind]}
			{@const KindIcon = kindMeta.icon}
			<div class="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
				<div class="flex items-start gap-3">
					<!-- Vote count (read-only internally) -->
					<div class="flex w-9 shrink-0 flex-col items-center rounded-md border border-neutral-200 py-1 dark:border-neutral-800">
						<ChevronUp size={14} class="text-neutral-400" />
						<span class="text-sm font-semibold tabular-nums">{s.votes}</span>
					</div>

					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-2">
							<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={`background:${kindMeta.color}22;color:${kindMeta.color}`}><KindIcon size={11} /> {kindMeta.label}</span>
							<span class="rounded-full px-2 py-0.5 text-[11px] font-medium" style={`background:${SUGGESTION_STATUS_META[s.status].color}22;color:${SUGGESTION_STATUS_META[s.status].color}`}>{SUGGESTION_STATUS_META[s.status].label}</span>
							{#if s.archived}<span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500 dark:bg-neutral-800">Archived</span>{/if}
							<a href={`${publicUrl}/${s.id}`} target="_blank" rel="noreferrer" class="min-w-0 flex-1 truncate font-medium hover:underline">{s.title}</a>
						</div>
						{#if s.body}<p class="mt-1 line-clamp-2 text-sm text-neutral-500">{s.body}</p>{/if}
						<div class="mt-1.5 flex items-center gap-3 text-xs text-neutral-400">
							{#if s.authorName}<span>by {s.authorName}</span>{/if}
							<span>{ago(s.createdAt)}</span>
							{#if s.comments > 0}<span class="flex items-center gap-1"><MessageSquare size={12} /> {s.comments}</span>{/if}
							<a href={`${publicUrl}/${s.id}`} target="_blank" rel="noreferrer" class="flex items-center gap-1 hover:text-neutral-600 dark:hover:text-neutral-300">Open thread <ExternalLink size={11} /></a>
						</div>

						<!-- Triage actions -->
						<div class="mt-2.5 flex flex-wrap items-center gap-1.5">
							{#if s.archived}
								<form method="POST" action="?/unarchive" use:enhance>
									<input type="hidden" name="id" value={s.id} />
									<Button size="sm" variant="default" type="submit"><ArchiveRestore size={14} /> Restore</Button>
								</form>
							{:else}
								{#if s.status !== 'converted'}
									<form method="POST" action="?/convert" use:enhance>
										<input type="hidden" name="id" value={s.id} />
										<Button size="sm" variant="primary" type="submit"><Ticket size={14} /> Convert to ticket</Button>
									</form>
								{/if}
								{#if s.status !== 'accepted'}
									<form method="POST" action="?/resolve" use:enhance>
										<input type="hidden" name="id" value={s.id} />
										<input type="hidden" name="status" value="accepted" />
										<Button size="sm" variant="default" type="submit"><Check size={14} /> Accept</Button>
									</form>
								{/if}
								{#if s.status !== 'declined'}
									<form method="POST" action="?/resolve" use:enhance>
										<input type="hidden" name="id" value={s.id} />
										<input type="hidden" name="status" value="declined" />
										<Button size="sm" variant="ghost" type="submit"><X size={14} /> Decline</Button>
									</form>
								{/if}
								<form method="POST" action="?/archive" use:enhance class="ml-auto">
									<input type="hidden" name="id" value={s.id} />
									<Button size="sm" variant="ghost" type="submit"><Archive size={14} /> Archive</Button>
								</form>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div class="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-400 dark:border-neutral-700">
				{#if data.view === 'triage'}
					Nothing to triage — you're all caught up. 🎉
				{:else if data.view === 'archived'}
					No archived suggestions.
				{:else}
					No suggestions here.
				{/if}
			</div>
		{/each}
	</div>
</div>
