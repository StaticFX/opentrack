<script lang="ts">
	import { ChevronUp } from '@lucide/svelte';
	import { renderMarkdown } from '$lib/markdown';
	import Button from '$lib/components/ui/Button.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';

	let { data } = $props();

	let voted = $state(data.voted);
	let votes = $state(data.ticket?.votes ?? 0);
	let comments = $state<any[]>(data.comments);
	let commentDraft = $state('');

	const t = $derived(data.ticket!);
	const boardUrl = $derived(`/${data.workspace.slug}/${data.project.slug}`);

	async function toggleVote() {
		if (data.interactionsLocked) return;
		voted = !voted;
		votes += voted ? 1 : -1;
		const res = await fetch(`/api/tickets/${t.id}/vote`, { method: 'POST' });
		if (res.ok) {
			const r = await res.json();
			voted = r.voted;
			votes = r.count;
		}
	}

	async function submitComment() {
		const body = commentDraft.trim();
		if (!body) return;
		commentDraft = '';
		comments = [...comments, { id: `tmp-${Date.now()}`, body, authorName: data.user?.displayName ?? 'You' }];
		await fetch(`/api/tickets/${t.id}/comments`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ body })
		});
	}
</script>

<svelte:head><title>#{t.number} {t.title} — {data.project.name}</title></svelte:head>

<main class="mx-auto max-w-3xl px-6 py-8">
	<a href={boardUrl} class="text-sm text-neutral-400 hover:text-neutral-600">← Back to board</a>

	<div class="mt-4 flex items-start gap-4">
		<button
			onclick={toggleVote}
			disabled={data.interactionsLocked}
			title={data.interactionsLocked ? 'Voting is closed — this ticket has been resolved' : undefined}
			class="flex shrink-0 flex-col items-center rounded-lg border px-3 py-2 transition {data.interactionsLocked ? 'cursor-not-allowed border-neutral-200 text-neutral-300 dark:border-neutral-800 dark:text-neutral-600' : voted ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800'}"
		>
			<ChevronUp size={18} />
			<span class="text-sm font-semibold">{votes}</span>
		</button>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2 text-sm text-neutral-400">
				<span class="font-mono">#{t.number}</span>
				{#if t.closedAt}<span class="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">Closed</span>{/if}
			</div>
			<h1 class="mt-1 text-2xl font-bold tracking-tight">{t.title}</h1>
			<div class="mt-2 flex flex-wrap items-center gap-1.5">
				{#each t.labels as l (l.id)}
					<span class="rounded px-1.5 py-0.5 text-[11px] font-medium" style={`background:${l.color}22;color:${l.color}`}>{l.name}</span>
				{/each}
			</div>
		</div>
	</div>

	{#if t.description}
		<div class="prose prose-sm dark:prose-invert mt-6 max-w-none">{@html renderMarkdown(t.description)}</div>
	{/if}

	<section class="mt-10 border-t border-neutral-200 pt-6 dark:border-neutral-800">
		<h2 class="mb-4 text-sm font-semibold">Comments ({comments.length})</h2>
		<div class="space-y-3">
			{#each comments as c (c.id)}
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
				<Textarea bind:value={commentDraft} rows={2} placeholder="Add a comment…" />
				<div class="mt-2"><Button size="sm" variant="primary" onclick={submitComment} disabled={!commentDraft.trim()}>Comment</Button></div>
			{:else if data.interactionsLocked}
				<p class="text-sm text-neutral-400">This ticket has been closed — comments are disabled.</p>
			{:else if !data.signedIn}
				<p class="text-sm text-neutral-500"><a href="/auth/login" class="text-brand-600 hover:underline">Sign in</a> to comment.</p>
			{:else}
				<p class="text-sm text-neutral-400">Comments are not open on this project.</p>
			{/if}
		</div>
	</section>
</main>
