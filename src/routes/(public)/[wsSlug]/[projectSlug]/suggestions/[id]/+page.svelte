<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check, X, Copy, Bell, BellOff } from '@lucide/svelte';
	import { renderMarkdown } from '$lib/markdown';
	import { SUGGESTION_STATUS_META } from '$lib/suggestionStatus';
	import { SUGGESTION_KIND_META } from '$lib/suggestionKind';
	import ReactionBar from '$lib/components/ReactionBar.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import UpvoteButton from '$lib/components/UpvoteButton.svelte';

	let { data, form } = $props();

	let watching = $state(data.watching);
	$effect(() => { watching = data.watching; });
	async function toggleWatch() {
		watching = !watching; // optimistic
		const res = await fetch('/api/watch', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ subjectType: 'suggestion', subjectId: data.suggestion.id, watch: watching })
		});
		if (res.ok) watching = (await res.json()).watching;
		else watching = !watching;
	}
	const s = $derived(data.suggestion);
	const kindMeta = $derived(SUGGESTION_KIND_META[s.kind]);
	const KindIcon = $derived(kindMeta.icon);

	// Merge-duplicate picker (triage).
	let mergeOpen = $state(false);
	let mergeQuery = $state('');
	let mergeResults = $state<Array<{ id: string; title: string; status: string }>>([]);
	let mergeTarget = $state('');
	let mergeForm = $state<HTMLFormElement | null>(null);
	let mergeTimer: ReturnType<typeof setTimeout> | undefined;
	function searchMerge() {
		clearTimeout(mergeTimer);
		mergeTimer = setTimeout(async () => {
			const res = await fetch(`/api/projects/${s.projectId}/suggestions/search?q=${encodeURIComponent(mergeQuery)}&exclude=${s.id}`);
			if (res.ok) mergeResults = (await res.json()).suggestions;
		}, 200);
	}
	function pickMerge(id: string) {
		mergeTarget = id;
		mergeForm?.requestSubmit();
	}

	const base = $derived(`/${data.workspace.slug}/${data.project.slug}/suggestions`);
	const internalBoard = $derived(`/w/${data.workspace.slug}/p/${data.project.slug}`);

	const decisions = [
		{ value: 'accepted', label: 'Accept', icon: Check, cls: 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300', active: 'ring-2 ring-green-400' },
		{ value: 'declined', label: 'Decline', icon: X, cls: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300', active: 'ring-2 ring-red-400' },
		{ value: 'duplicate', label: 'Duplicate', icon: Copy, cls: 'border-neutral-300 bg-neutral-50 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300', active: 'ring-2 ring-neutral-400' }
	] as const;

	let noteDraft = $state('');
	let commentDraft = $state('');
</script>

<svelte:head><title>{s.title} — Feedback</title></svelte:head>

<main class="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
	<a href={base} class="text-sm text-neutral-400 hover:text-neutral-600">← All feedback</a>

	<div class="mt-4 flex items-start gap-4">
		<UpvoteButton subjectType="suggestion" id={s.id} count={data.votes} voted={data.voted} locked={data.interactionsLocked} />
		<div class="min-w-0 flex-1">
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={`background:${kindMeta.color}22;color:${kindMeta.color}`}><KindIcon size={11} /> {kindMeta.label}</span>
					<span class="rounded-full px-2 py-0.5 text-[11px] font-medium" style={`background:${SUGGESTION_STATUS_META[s.status].color}22;color:${SUGGESTION_STATUS_META[s.status].color}`}>{SUGGESTION_STATUS_META[s.status].label}</span>
					{#if s.authorName}<span class="text-xs text-neutral-400">by {#if s.authorUsername}<a href={`/u/${s.authorUsername}`} class="hover:text-neutral-600 hover:underline dark:hover:text-neutral-300">{s.authorName}</a>{:else}{s.authorName}{/if}</span>{/if}
				</div>
				{#if data.signedIn}
					<button
						onclick={toggleWatch}
						class={`flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${watching ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
						title={watching ? 'Stop watching' : 'Watch for updates'}
					>
						{#if watching}<Bell size={13} /> Watching{:else}<BellOff size={13} /> Watch{/if}
					</button>
				{/if}
			</div>
			<h1 class="mt-1.5 text-2xl font-bold tracking-tight">{s.title}</h1>
		</div>
	</div>

	{#if s.body}<div class="prose prose-sm dark:prose-invert mt-5 max-w-none">{@html renderMarkdown(s.body)}</div>{/if}

	<div class="mt-4"><ReactionBar subjectType="suggestion" subjectId={s.id} reactions={data.suggestionReactions} canReact={data.signedIn} /></div>

	{#if s.convertedTicketId}
		<div class="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm dark:border-teal-900/50 dark:bg-teal-950/30">
			Converted to a ticket. <a href={internalBoard} class="font-medium text-teal-700 hover:underline dark:text-teal-300">Open board →</a>
		</div>
	{/if}

	{#if s.duplicateOfTitle}
		<div class="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-800/40">
			Merged as a duplicate of <a href={`${base}/${s.duplicateOfId}`} class="font-medium text-brand-600 hover:underline">{s.duplicateOfTitle} →</a>
		</div>
	{/if}

	<!-- Triage (maintainers / admins) -->
	{#if data.canTriage}
		<div class="mt-6 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
			<div class="mb-2 flex items-center justify-between">
				<h2 class="text-sm font-semibold">Triage</h2>
				<span class="text-xs text-neutral-400">
					Status:
					<span class="rounded-full px-1.5 py-0.5 font-medium" style={`background:${SUGGESTION_STATUS_META[s.status].color}22;color:${SUGGESTION_STATUS_META[s.status].color}`}>{SUGGESTION_STATUS_META[s.status].label}</span>
				</span>
			</div>
			<form
				method="POST"
				action="?/resolve"
				use:enhance={() => async ({ update }) => { noteDraft = ''; await update({ reset: false }); }}
			>
				<Textarea name="note" bind:value={noteDraft} rows={2} placeholder="Add a note explaining your decision (optional — posted as a comment)…" />
				<div class="mt-3 flex flex-wrap gap-2">
					{#each decisions as d (d.value)}
						<button
							name="status"
							value={d.value}
							type="submit"
							class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition {d.cls} {s.status === d.value ? d.active : ''}"
						>
							<d.icon size={15} /> {d.label}
						</button>
					{/each}
				</div>
			</form>
			<div class="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
				{#if !s.convertedTicketId && !s.duplicateOfTitle}
					<form method="POST" action="?/convert" use:enhance>
						<Button variant="ghost" size="sm" type="submit">Convert to ticket</Button>
					</form>
				{/if}
				{#if !s.duplicateOfTitle}
					<Button variant="ghost" size="sm" onclick={() => (mergeOpen = !mergeOpen)}>Merge duplicate…</Button>
				{/if}
			</div>

			{#if mergeOpen && !s.duplicateOfTitle}
				<div class="mt-2 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
					<input
						bind:value={mergeQuery}
						oninput={searchMerge}
						placeholder="Search a suggestion to merge THIS one into…"
						class="h-8 w-full rounded-md border border-neutral-200 px-2 text-sm focus-visible:border-brand-500 focus-visible:outline-none dark:border-neutral-800 dark:bg-neutral-900"
					/>
					<div class="mt-1 max-h-44 overflow-y-auto">
						{#each mergeResults as r (r.id)}
							<button
								type="button"
								onclick={() => pickMerge(r.id)}
								class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
							>
								<span class="min-w-0 flex-1 truncate">{r.title}</span>
								<span class="shrink-0 text-[10px] text-neutral-400">{r.status}</span>
							</button>
						{:else}
							{#if mergeQuery}<p class="px-2 py-1.5 text-xs text-neutral-400">No matches.</p>{/if}
						{/each}
					</div>
					<form method="POST" action="?/merge" bind:this={mergeForm} use:enhance={() => async ({ update }) => { mergeOpen = false; mergeQuery = ''; mergeResults = []; await update(); }}>
						<input type="hidden" name="targetId" value={mergeTarget} />
					</form>
				</div>
			{/if}
			{#if form?.error}<p class="mt-2 text-sm text-red-600">{form.error}</p>{/if}
		</div>
	{/if}

	<!-- Comments -->
	<section class="mt-10 border-t border-neutral-200 pt-6 dark:border-neutral-800">
		<h2 class="mb-4 text-sm font-semibold">Comments ({data.comments.length})</h2>
		<div class="space-y-3">
			{#each data.comments as c (c.id)}
				<div class="flex gap-2.5">
					<div class="grid size-7 shrink-0 place-items-center rounded-full bg-neutral-200 text-[11px] font-semibold dark:bg-neutral-700">{(c.authorName ?? '?').slice(0, 1).toUpperCase()}</div>
					<div class="min-w-0 flex-1 rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800/40">
						<p class="mb-0.5 text-xs font-medium text-neutral-600 dark:text-neutral-300">{c.authorName ?? 'Unknown'}</p>
						<div class="prose prose-sm dark:prose-invert max-w-none">{@html renderMarkdown(c.body)}</div>
						<div class="mt-1.5"><ReactionBar subjectType="comment" subjectId={c.id} reactions={c.reactions ?? []} canReact={data.signedIn} size="sm" /></div>
					</div>
				</div>
			{:else}
				<p class="text-sm text-neutral-400">No comments yet.</p>
			{/each}
		</div>

		<div class="mt-4">
			{#if data.canComment}
				<form method="POST" action="?/comment" use:enhance={() => async ({ update }) => { commentDraft = ''; await update(); }}>
					<Textarea name="body" bind:value={commentDraft} rows={2} placeholder="Add a comment…" />
					<div class="mt-2"><Button size="sm" variant="primary" type="submit" disabled={!commentDraft.trim()}>Comment</Button></div>
				</form>
			{:else if data.interactionsLocked}
				<p class="text-sm text-neutral-400">This suggestion has been resolved — comments are closed.</p>
			{:else if !data.signedIn}
				<p class="text-sm text-neutral-500"><a href="/auth/login" class="text-brand-600 hover:underline">Sign in</a> to comment.</p>
			{:else}
				<p class="text-sm text-neutral-400">Comments are not open on this project.</p>
			{/if}
		</div>
	</section>
</main>
