<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { ArrowLeft, Lock } from '@lucide/svelte';
	import { confettiFrom } from '$lib/confetti';
	import { renderMarkdown } from '$lib/markdown';
	import { SUGGESTION_KIND_META } from '$lib/suggestionKind';
	import FeedbackJourney from '$lib/components/public/FeedbackJourney.svelte';
	import PostSuccessCard from '$lib/components/public/PostSuccessCard.svelte';
	import PublicMeta from '$lib/components/public/PublicMeta.svelte';
	import WatchButton from '$lib/components/public/WatchButton.svelte';
	import ReactionBar from '$lib/components/ReactionBar.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import UpvoteButton from '$lib/components/UpvoteButton.svelte';

	let { data } = $props();

	const s = $derived(data.suggestion);
	const kindMeta = $derived(SUGGESTION_KIND_META[s.kind]);
	const KindIcon = $derived(kindMeta.icon);
	const base = $derived(`/${data.workspace.slug}/${data.project.slug}/suggestions`);

	// ---- Fresh-post celebration (?posted=1 → confetti + roadmap explainer) --
	let justPosted = $state(false);
	let articleEl = $state<HTMLElement | null>(null);
	onMount(() => {
		const url = new URL(location.href);
		if (url.searchParams.get('posted') === '1') {
			justPosted = true;
			url.searchParams.delete('posted');
			replaceState(url, {});
			setTimeout(() => confettiFrom(articleEl), 250);
		}
	});

	// ---- Social proof + comment-after-vote nudge ---------------------------
	let liveVotes = $state(data.votes);
	$effect(() => {
		liveVotes = data.votes;
	});
	const proofLine = $derived.by(() => {
		const n = liveVotes;
		if (n === 0) return 'Be the first to back this';
		const noun = s.kind === 'bug' ? 'hit this too' : `want${n === 1 ? 's' : ''} this`;
		const subject = n === 1 ? '1 person' : `${n} people`;
		return `${subject} ${noun}${n >= 10 ? " — it's getting noticed" : ''}`;
	});

	let voteNudge = $state(false);
	let commentDraft = $state('');
	function onVote(voted: boolean, confirmed: number) {
		// The server-confirmed total includes everyone else's votes too.
		liveVotes = confirmed;
		if (
			voted &&
			data.canComment &&
			!commentDraft.trim() &&
			typeof localStorage !== 'undefined' &&
			!localStorage.getItem('ot-vote-nudge')
		) {
			voteNudge = true;
		}
	}
	function dismissNudge() {
		voteNudge = false;
		try {
			localStorage.setItem('ot-vote-nudge', '1');
		} catch {
			/* fine */
		}
	}
	const quickFills = $derived(
		s.kind === 'bug'
			? ['Happens to me constantly.', 'Found a workaround, but it hurts.']
			: ['This blocks my workflow.', "I'd use this every day."]
	);

	const loginHref = $derived(`/auth/login?redirect=${encodeURIComponent(page.url.pathname)}`);
</script>

<PublicMeta
	title={s.title}
	description={`${liveVotes} ${liveVotes === 1 ? 'person wants' : 'people want'} this · ${kindMeta.label} for ${data.project.name}`}
	type="article"
/>

<main class="mx-auto max-w-3xl px-4 py-6 sm:px-6">
	<a
		href={base}
		class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-200"
	>
		<ArrowLeft size={13} /> All feedback
	</a>

	{#if justPosted}
		<div class="mt-3">
			<PostSuccessCard watching={data.watching} ondismiss={() => (justPosted = false)} />
		</div>
	{/if}

	<article
		bind:this={articleEl}
		class="pub-card ot-rise mt-3 rounded-3xl p-5 sm:p-6"
		style={`view-transition-name: s-${s.id.slice(0, 8)}`}
	>
		<div class="flex items-start gap-4">
			<div class="flex shrink-0 flex-col items-center gap-1.5">
				<UpvoteButton subjectType="suggestion" id={s.id} count={data.votes} voted={data.voted} locked={data.interactionsLocked} onvote={onVote} />
			</div>
			<div class="min-w-0 flex-1">
				<div class="flex items-start justify-between gap-2">
					<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
						<span
							class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
							style={`background:color-mix(in oklab, ${kindMeta.color} 12%, transparent);color:${kindMeta.color}`}
						><KindIcon size={11} /> {kindMeta.label}</span>
						{#if s.authorName}
							<span class="text-xs text-neutral-400">
								by {#if s.authorUsername}<a href={`/u/${s.authorUsername}`} class="font-medium hover:text-neutral-700 hover:underline dark:hover:text-neutral-200">{s.authorName}</a>{:else}{s.authorName}{/if}
							</span>
						{/if}
					</div>
					<WatchButton subjectType="suggestion" subjectId={s.id} watching={data.watching} signedIn={data.signedIn} />
				</div>
				<h1 class="type-poster mt-2 text-2xl">{s.title}</h1>
				<p class="mt-1 font-mono text-[11px] text-neutral-400">{proofLine}</p>
			</div>
		</div>

		<!-- The Journey -->
		<div class="mt-6 border-t border-black/5 pt-5 dark:border-white/5">
			<FeedbackJourney
				stage={data.journey.stage}
				postedAt={data.journey.postedAt}
				votes={liveVotes}
				kind={data.journey.kind}
				duplicateOf={data.journey.duplicateOf}
				ticket={data.journey.ticket}
			/>
		</div>

		{#if s.body}<div class="prose prose-sm dark:prose-invert mt-5 max-w-none border-t border-black/5 pt-5 dark:border-white/5">{@html renderMarkdown(s.body)}</div>{/if}

		<div class="mt-5"><ReactionBar subjectType="suggestion" subjectId={s.id} reactions={data.suggestionReactions} canReact={data.signedIn} seed /></div>
	</article>

	<!-- Comments -->
	<section class="mt-6">
		<h2 class="pub-label mb-3 px-1">
			{data.comments.length} {data.comments.length === 1 ? 'comment' : 'comments'}
		</h2>
		<div class="space-y-2.5">
			{#each data.comments as c, i (c.id)}
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
						<div class="mt-2"><ReactionBar subjectType="comment" subjectId={c.id} reactions={c.reactions ?? []} canReact={data.signedIn} size="sm" /></div>
					</div>
				</div>
			{:else}
				<p class="px-1 text-sm text-neutral-400">No comments yet — start the conversation.</p>
			{/each}
		</div>

		<div class="mt-5">
			{#if data.canComment}
				{#if voteNudge}
					<div class="mb-2 flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--accent-wash)] px-3.5 py-2.5 text-xs">
						<p class="font-medium text-neutral-700 dark:text-neutral-200">You backed it — now tell them why. Reasons carry more weight than numbers.</p>
						{#each quickFills as q (q)}
							<button
								onclick={() => { commentDraft = q; voteNudge = false; }}
								class="rounded-full border border-[var(--accent-border)] px-2.5 py-1 font-medium text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-soft)]"
							>{q}</button>
						{/each}
						<button onclick={dismissNudge} class="ml-auto text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">Don't ask again</button>
					</div>
				{/if}
				<form method="POST" action="?/comment" use:enhance={() => async ({ update }) => { commentDraft = ''; await update(); }} class="pub-card p-3.5">
					<Textarea name="body" bind:value={commentDraft} rows={2} placeholder="Add to the discussion…" class="border-transparent bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent" />
					<div class="mt-2 flex justify-end">
						<Button size="sm" variant="accent" type="submit" disabled={!commentDraft.trim()} class="rounded-full px-4">Comment</Button>
					</div>
				</form>
			{:else if data.interactionsLocked}
				<p class="flex items-center gap-2 px-1 text-sm text-neutral-400"><Lock size={14} /> This one's been decided — the thread is closed, but the votes are part of history.</p>
			{:else if !data.signedIn}
				<p class="px-1 text-sm text-neutral-500"><a href={loginHref} class="font-medium text-[var(--accent-fg)] hover:underline">Sign in</a> to join in — it takes one click.</p>
			{:else}
				<p class="px-1 text-sm text-neutral-400">Comments are not open on this project.</p>
			{/if}
		</div>
	</section>
</main>
