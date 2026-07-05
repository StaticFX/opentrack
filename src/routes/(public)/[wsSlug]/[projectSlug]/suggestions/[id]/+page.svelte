<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check, X, Copy } from '@lucide/svelte';
	import { renderMarkdown } from '$lib/markdown';
	import { SUGGESTION_STATUS_META } from '$lib/suggestionStatus';
	import Button from '$lib/components/ui/Button.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import UpvoteButton from '$lib/components/UpvoteButton.svelte';

	let { data, form } = $props();
	const s = $derived(data.suggestion);
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

<svelte:head><title>{s.title} — Suggestions</title></svelte:head>

<main class="mx-auto max-w-3xl px-6 py-8">
	<a href={base} class="text-sm text-neutral-400 hover:text-neutral-600">← All suggestions</a>

	<div class="mt-4 flex items-start gap-4">
		<UpvoteButton subjectType="suggestion" id={s.id} count={data.votes} voted={data.voted} locked={data.interactionsLocked} />
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<span class="rounded-full px-2 py-0.5 text-[11px] font-medium" style={`background:${SUGGESTION_STATUS_META[s.status].color}22;color:${SUGGESTION_STATUS_META[s.status].color}`}>{SUGGESTION_STATUS_META[s.status].label}</span>
				{#if s.authorName}<span class="text-xs text-neutral-400">by {s.authorName}</span>{/if}
			</div>
			<h1 class="mt-1.5 text-2xl font-bold tracking-tight">{s.title}</h1>
		</div>
	</div>

	{#if s.body}<div class="prose prose-sm dark:prose-invert mt-5 max-w-none">{@html renderMarkdown(s.body)}</div>{/if}

	{#if s.convertedTicketId}
		<div class="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm dark:border-teal-900/50 dark:bg-teal-950/30">
			Converted to a ticket. <a href={internalBoard} class="font-medium text-teal-700 hover:underline dark:text-teal-300">Open board →</a>
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
			{#if !s.convertedTicketId}
				<form method="POST" action="?/convert" use:enhance class="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
					<Button variant="ghost" size="sm" type="submit">Convert to ticket</Button>
				</form>
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
