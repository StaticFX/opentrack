<script lang="ts">
	import { ArrowLeft, CircleCheckBig, Lightbulb, Lock, PartyPopper } from '@lucide/svelte';
	import { page } from '$app/state';
	import { renderMarkdown } from '$lib/markdown';
	import PublicMeta from '$lib/components/public/PublicMeta.svelte';
	import TicketFacts from '$lib/components/public/TicketFacts.svelte';
	import WatchButton from '$lib/components/public/WatchButton.svelte';
	import ReactionBar from '$lib/components/ReactionBar.svelte';
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
		class="mono-focus inline-flex items-center gap-1.5 text-[12px] tracking-tight text-[var(--faint)] transition-colors hover:text-[var(--accent)]"
	>
		<ArrowLeft size={12} /> Back to board
	</a>

	<article class="ot-rise mt-8" style={`view-transition-name: t-${t.number}`}>
		<div class="flex items-start gap-4">
			<div class="flex shrink-0 flex-col items-center gap-1.5">
				<UpvoteButton subjectType="ticket" id={t.id} count={t.votes} voted={data.voted} locked={data.interactionsLocked} />
			</div>

			<div class="min-w-0 flex-1">
				<div class="flex items-start justify-between gap-2">
					<div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
						<span class="tabular-nums text-[var(--faint)]">#{t.number}</span>
						{#if t.closedAt}
							<span class="flex items-center gap-1 tracking-[0.14em] text-[var(--green)] uppercase">
								<CircleCheckBig size={11} /> Closed
							</span>
						{/if}
					</div>
					<WatchButton subjectType="ticket" subjectId={t.id} watching={data.watching} signedIn={data.signedIn} />
				</div>
				<h1 class="mono-display mt-3 text-2xl leading-tight tracking-tight text-[var(--text)] sm:text-3xl">{t.title}</h1>
				{#if t.labels.length}
					<div class="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
						{#each t.labels as l (l.id)}
							<span style={`color:${l.color}`}>#{l.name}</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		{#if data.release}
			<div class="mt-6 flex items-center gap-2.5 border-l-2 border-[var(--green)] py-1.5 pl-3 text-[13px]">
				<PartyPopper size={14} class="shrink-0 text-[var(--green)]" />
				<span class="text-[var(--dim)]">Shipped in <a href={`${base}/releases`} class="mono-focus tabular-nums text-[var(--text)] transition-colors hover:text-[var(--accent)]">{data.release.version}</a>{#if data.release.releasedAt}&nbsp;— {ago(data.release.releasedAt)}{/if}</span>
			</div>
		{/if}

		{#if data.originSuggestion}
			<div class="mt-6 flex items-center gap-2.5 border-l-2 border-[var(--accent)] py-1.5 pl-3 text-[13px]">
				<Lightbulb size={14} class="shrink-0 text-[var(--accent)]" />
				<span class="text-[var(--dim)]">
					Born from a community suggestion with <span class="tabular-nums text-[var(--text)]">{data.originSuggestion.votes}</span> {data.originSuggestion.votes === 1 ? 'vote' : 'votes'} —
					<a href={`${base}/suggestions/${data.originSuggestion.id}`} class="mono-focus text-[var(--accent)] transition-colors hover:underline">see the original thread</a>
				</span>
			</div>
		{/if}

		<div class="mt-6 border-t border-[var(--rule)] pt-5">
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
			<div class="prose prose-sm prose-invert mt-6 max-w-none border-t border-[var(--rule)] pt-6">{@html renderMarkdown(t.description)}</div>
		{/if}

		<div class="mt-6"><ReactionBar subjectType="ticket" subjectId={t.id} reactions={data.ticketReactions} canReact={data.signedIn} seed /></div>
	</article>

	<section class="mt-10 border-t border-[var(--rule)] pt-8">
		<div class="flex items-baseline justify-between gap-4">
			<h2 class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Comments</h2>
			<span class="text-[11px] tabular-nums text-[var(--faint)]">{comments.length}</span>
		</div>

		<ul class="mt-5">
			{#each comments as c, i (c.id)}
				<li class="ot-rise flex gap-3 border-t border-[var(--rule)] py-4" style={`--rise-i:${i}`}>
					{#if c.authorAvatar}
						<img src={c.authorAvatar} alt="" class="size-8 shrink-0 rounded-full object-cover" />
					{:else}
						<span class="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--raised)] text-[11px] font-semibold text-[var(--dim)] ring-1 ring-[var(--rule)]">
							{(c.authorName ?? '?').slice(0, 1).toUpperCase()}
						</span>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="text-[12px] text-[var(--dim)]">{c.authorName ?? 'Unknown'}</p>
						<div class="prose prose-sm prose-invert mt-1 max-w-none">{@html renderMarkdown(c.body)}</div>
					</div>
				</li>
			{:else}
				<li class="border-t border-[var(--rule)] py-8 text-center text-[12px] text-[var(--faint)]">No comments yet — start the conversation.</li>
			{/each}
		</ul>

		<div class="mt-6">
			{#if data.canComment}
				<div class="flex items-start gap-2 border-b border-[var(--rule)] pb-2 transition-colors focus-within:border-[var(--accent)]">
					<span class="pt-2 text-[13px] text-[var(--faint)]" aria-hidden="true">&gt;</span>
					<Textarea
						bind:value={commentDraft}
						rows={2}
						placeholder="Add to the discussion…"
						class="mono-focus resize-none border-0 bg-transparent px-0 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--faint)] shadow-none focus-visible:border-0 focus-visible:ring-0 dark:border-0 dark:bg-transparent"
					/>
				</div>
				{#if commentError}<p class="mt-1.5 text-[12px] text-[var(--amber)]">{commentError}</p>{/if}
				<div class="mt-2 flex justify-end">
					<button
						type="button"
						onclick={submitComment}
						disabled={!commentDraft.trim()}
						class="mono-focus border border-[var(--accent)] px-3.5 py-1.5 text-[12px] tracking-tight text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--ground)] disabled:pointer-events-none disabled:opacity-40"
					>Comment</button>
				</div>
			{:else if data.interactionsLocked}
				<p class="flex items-center gap-2 text-[13px] text-[var(--faint)]"><Lock size={14} /> Closed and done. <a href={`${base}/board`} class="mono-focus text-[var(--accent)] transition-colors hover:underline">See what's next on the board →</a></p>
			{:else if !data.signedIn}
				<p class="text-[13px] text-[var(--dim)]"><a href={loginHref} class="mono-focus text-[var(--accent)] transition-colors hover:underline">Sign in</a> to comment — it takes one click.</p>
			{:else}
				<p class="text-[13px] text-[var(--faint)]">Comments are not open on this project.</p>
			{/if}
		</div>
	</section>
</main>
