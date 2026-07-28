<script lang="ts">
	import { ArrowLeft, CircleCheckBig, Lightbulb, Lock, PartyPopper } from '@lucide/svelte';
	import { page } from '$app/state';
	import { renderMarkdown } from '$lib/markdown';
	import PublicMeta from '$lib/components/public/PublicMeta.svelte';
	import TicketFacts from '$lib/components/public/TicketFacts.svelte';
	import WatchButton from '$lib/components/public/WatchButton.svelte';
	import ReactionBar from '$lib/components/ReactionBar.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import UpvoteButton from '$lib/components/UpvoteButton.svelte';
	import { ago } from '$lib/time';

	let { data } = $props();

	const t = $derived(data.ticket!);
	const base = $derived(`/${data.workspace.slug}/${data.project.slug}`);

	// Seeded from the load data so SSR renders the full thread (crawlers, no-JS);
	// the $effect keeps it in sync with later invalidate reloads.
	let comments = $state<Array<{ id: string; body: string; authorName: string | null; authorAvatar?: string | null }>>([
		...data.comments
	]);
	$effect(() => {
		comments = [...data.comments];
	});
	let commentDraft = $state('');
	let commentError = $state<string | null>(null);

	async function submitComment() {
		const body = commentDraft.trim();
		if (!body) return;
		commentDraft = '';
		commentError = null;
		const tmp = { id: `tmp-${Math.random().toString(36).slice(2)}`, body, authorName: data.user?.displayName ?? 'You', authorAvatar: data.user?.avatarUrl };
		comments = [...comments, tmp];
		const res = await fetch(`/api/tickets/${t.id}/comments`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ body })
		});
		if (!res.ok) {
			// Roll the optimistic comment back and restore the draft.
			comments = comments.filter((c) => c.id !== tmp.id);
			commentDraft = body;
			commentError =
				res.status === 429 ? 'Slow down — try again in a minute.' : "Your comment didn't go through — try again.";
		}
	}

	const metaDesc = $derived.by(() => {
		const plain = (t.description ?? '').replace(/[#*_`>\[\]()!-]/g, '').replace(/\s+/g, ' ').trim();
		if (plain) return plain.slice(0, 140);
		return `${t.closedAt ? 'Shipped' : data.column ? data.column.name : 'Tracked'} · ${data.project.name}`;
	});

	const loginHref = $derived(`/auth/login?redirect=${encodeURIComponent(page.url.pathname)}`);
</script>

<PublicMeta title={`#${t.number} ${t.title}`} description={metaDesc} type="article" />

<main class="mx-auto max-w-3xl px-4 py-6 sm:px-6">
	<a
		href={`${base}/board`}
		class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-200"
	>
		<ArrowLeft size={13} /> Back to board
	</a>

	<article class="pub-card ot-rise mt-3 rounded-3xl p-5 sm:p-6" style={`view-transition-name: t-${t.number}`}>
		<div class="flex items-start gap-4">
			<UpvoteButton subjectType="ticket" id={t.id} count={t.votes} voted={data.voted} locked={data.interactionsLocked} />

			<div class="min-w-0 flex-1">
				<div class="flex items-start justify-between gap-2">
					<div class="flex flex-wrap items-center gap-2 text-sm text-neutral-400">
						<span class="font-mono text-xs">#{t.number}</span>
						{#if t.closedAt}
							<span class="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:text-green-300">
								<CircleCheckBig size={11} /> Closed
							</span>
						{/if}
					</div>
					<WatchButton subjectType="ticket" subjectId={t.id} watching={data.watching} signedIn={data.signedIn} />
				</div>
				<h1 class="type-poster mt-1.5 text-2xl">{t.title}</h1>
				{#if t.labels.length}
					<div class="mt-2.5 flex flex-wrap items-center gap-1.5">
						{#each t.labels as l (l.id)}
							<span class="rounded-full px-2 py-0.5 text-[11px] font-medium" style={`background:color-mix(in oklab, ${l.color} 12%, transparent);color:${l.color}`}>{l.name}</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		{#if data.release}
			<div class="mt-5 flex items-center gap-2.5 rounded-2xl bg-green-500/10 p-3 text-sm text-green-800 dark:text-green-200">
				<PartyPopper size={16} class="shrink-0 text-green-600 dark:text-green-300" />
				<span>Shipped in <a href={`${base}/releases`} class="font-mono font-semibold hover:underline">{data.release.version}</a>{#if data.release.releasedAt}&nbsp;— {ago(data.release.releasedAt)}{/if}</span>
			</div>
		{/if}

		{#if data.originSuggestion}
			<div class="mt-5 flex items-center gap-2.5 rounded-2xl p-3 text-sm" style="background:var(--accent-wash)">
				<Lightbulb size={16} class="shrink-0 text-[var(--accent-fg)]" />
				<span class="text-neutral-700 dark:text-neutral-200">
					Born from a community suggestion with <span class="font-mono font-semibold">{data.originSuggestion.votes}</span> {data.originSuggestion.votes === 1 ? 'vote' : 'votes'} —
					<a href={`${base}/suggestions/${data.originSuggestion.id}`} class="font-semibold text-[var(--accent-fg)] hover:underline">see the original thread</a>
				</span>
			</div>
		{/if}

		<div class="mt-5 border-t border-black/5 pt-4 dark:border-white/5">
			<TicketFacts
				createdAt={t.createdAt}
				closedAt={t.closedAt}
				authorName={t.authorName}
				column={data.column}
				milestone={t.milestone}
				assignees={t.assignees}
				relations={t.relations}
				githubRepo={t.githubRepo}
				githubIssueNumber={t.githubIssueNumber}
				githubPrNumber={t.githubPrNumber}
				githubPrState={t.githubPrState}
				githubCiStatus={t.githubCiStatus}
				{base}
			/>
		</div>

		{#if t.description}
			<div class="prose prose-sm dark:prose-invert mt-5 max-w-none border-t border-black/5 pt-5 dark:border-white/5">{@html renderMarkdown(t.description)}</div>
		{/if}

		<div class="mt-5"><ReactionBar subjectType="ticket" subjectId={t.id} reactions={data.ticketReactions} canReact={data.signedIn} seed /></div>
	</article>

	<section class="mt-6">
		<h2 class="pub-label mb-3 px-1">
			{comments.length} {comments.length === 1 ? 'comment' : 'comments'}
		</h2>
		<div class="space-y-2.5">
			{#each comments as c, i (c.id)}
				<div class="ot-rise flex gap-3" style={`--rise-i:${i}`}>
					{#if c.authorAvatar}
						<img src={c.authorAvatar} alt="" class="size-8 shrink-0 rounded-full object-cover" />
					{:else}
						<div class="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-b from-neutral-200 to-neutral-300 text-[11px] font-bold text-neutral-600 dark:from-neutral-600 dark:to-neutral-700 dark:text-neutral-200">
							{(c.authorName ?? '?').slice(0, 1).toUpperCase()}
						</div>
					{/if}
					<div class="pub-card min-w-0 flex-1 px-4 py-3">
						<p class="mb-1 text-xs font-semibold text-neutral-600 dark:text-neutral-300">{c.authorName ?? 'Unknown'}</p>
						<div class="prose prose-sm dark:prose-invert max-w-none">{@html renderMarkdown(c.body)}</div>
					</div>
				</div>
			{:else}
				<p class="px-1 text-sm text-neutral-400">No comments yet — start the conversation.</p>
			{/each}
		</div>

		<div class="mt-5">
			{#if data.canComment}
				<div class="pub-card p-3.5">
					<Textarea bind:value={commentDraft} rows={2} placeholder="Add to the discussion…" class="border-transparent bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent" />
					{#if commentError}<p class="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{commentError}</p>{/if}
					<div class="mt-2 flex justify-end">
						<Button size="sm" variant="accent" onclick={submitComment} disabled={!commentDraft.trim()} class="rounded-full px-4">Comment</Button>
					</div>
				</div>
			{:else if data.interactionsLocked}
				<p class="flex items-center gap-2 px-1 text-sm text-neutral-400"><Lock size={14} /> Closed and done. <a href={`${base}/board`} class="font-medium text-[var(--accent-fg)] hover:underline">See what's next on the board →</a></p>
			{:else if !data.signedIn}
				<p class="px-1 text-sm text-neutral-500"><a href={loginHref} class="font-medium text-[var(--accent-fg)] hover:underline">Sign in</a> to comment — it takes one click.</p>
			{:else}
				<p class="px-1 text-sm text-neutral-400">Comments are not open on this project.</p>
			{/if}
		</div>
	</section>
</main>
