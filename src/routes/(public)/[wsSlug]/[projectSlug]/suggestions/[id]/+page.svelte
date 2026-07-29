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
		class="mono-focus inline-flex items-center gap-1.5 text-[12px] tracking-tight text-[var(--faint)] transition-colors hover:text-[var(--accent)]"
	>
		<ArrowLeft size={12} /> All feedback
	</a>

	{#if justPosted}
		<div class="mt-4">
			<PostSuccessCard watching={data.watching} ondismiss={() => (justPosted = false)} />
		</div>
	{/if}

	<article bind:this={articleEl} class="ot-rise mt-8" style={`view-transition-name: s-${s.id.slice(0, 8)}`}>
		<div class="flex items-start gap-4">
			<div class="flex shrink-0 flex-col items-center gap-1.5">
				<UpvoteButton subjectType="suggestion" id={s.id} count={data.votes} voted={data.voted} locked={data.interactionsLocked} onvote={onVote} />
			</div>
			<div class="min-w-0 flex-1">
				<div class="flex items-start justify-between gap-2">
					<div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
						<span class="flex items-center gap-1 tracking-[0.14em] uppercase" style={`color:${kindMeta.color}`}>
							<KindIcon size={11} /> {kindMeta.label}
						</span>
						{#if s.authorName}
							<span class="text-[var(--faint)]">
								by {#if s.authorUsername}<a href={`/u/${s.authorUsername}`} class="mono-focus text-[var(--dim)] transition-colors hover:text-[var(--accent)]">{s.authorName}</a>{:else}{s.authorName}{/if}
							</span>
						{/if}
					</div>
					<WatchButton subjectType="suggestion" subjectId={s.id} watching={data.watching} signedIn={data.signedIn} />
				</div>
				<h1 class="mono-display mt-3 text-2xl leading-tight tracking-tight text-[var(--text)] sm:text-3xl">{s.title}</h1>
				<p class="mt-2 text-[12px] text-[var(--faint)]">{proofLine}</p>
			</div>
		</div>

		<!-- The Journey -->
		<div class="mt-8 border-t border-[var(--rule)] pt-6">
			<FeedbackJourney
				stage={data.journey.stage}
				postedAt={data.journey.postedAt}
				votes={liveVotes}
				kind={data.journey.kind}
				duplicateOf={data.journey.duplicateOf}
				ticket={data.journey.ticket}
			/>
		</div>

		{#if s.body}<div class="prose prose-sm prose-invert mt-6 max-w-none border-t border-[var(--rule)] pt-6">{@html renderMarkdown(s.body)}</div>{/if}

		<div class="mt-6"><ReactionBar subjectType="suggestion" subjectId={s.id} reactions={data.suggestionReactions} canReact={data.signedIn} seed /></div>
	</article>

	<!-- Comments -->
	<section class="mt-10 border-t border-[var(--rule)] pt-8">
		<div class="flex items-baseline justify-between gap-4">
			<h2 class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Comments</h2>
			<span class="text-[11px] tabular-nums text-[var(--faint)]">{data.comments.length}</span>
		</div>

		<ul class="mt-5">
			{#each data.comments as c, i (c.id)}
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
						<div class="mt-2"><ReactionBar subjectType="comment" subjectId={c.id} reactions={c.reactions ?? []} canReact={data.signedIn} size="sm" /></div>
					</div>
				</li>
			{:else}
				<li class="border-t border-[var(--rule)] py-8 text-center text-[12px] text-[var(--faint)]">No comments yet — start the conversation.</li>
			{/each}
		</ul>

		<div class="mt-6">
			{#if data.canComment}
				{#if voteNudge}
					<div class="mb-4 border-l-2 border-[var(--accent)] py-1.5 pl-3 text-[12px]">
						<p class="text-[var(--dim)]">You backed it — now tell them why. Reasons carry more weight than numbers.</p>
						<div class="mt-2 flex flex-wrap items-center gap-2">
							{#each quickFills as q (q)}
								<button
									onclick={() => { commentDraft = q; voteNudge = false; }}
									class="mono-focus border border-[var(--rule)] px-2.5 py-1 text-[var(--dim)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
								>{q}</button>
							{/each}
							<button onclick={dismissNudge} class="mono-focus ml-auto text-[var(--faint)] transition-colors hover:text-[var(--text)]">Don't ask again</button>
						</div>
					</div>
				{/if}
				<form method="POST" action="?/comment" use:enhance={() => async ({ update }) => { commentDraft = ''; await update(); }}>
					<div class="flex items-start gap-2 border-b border-[var(--rule)] pb-2 transition-colors focus-within:border-[var(--accent)]">
						<span class="pt-2 text-[13px] text-[var(--faint)]" aria-hidden="true">&gt;</span>
						<Textarea
							name="body"
							bind:value={commentDraft}
							rows={2}
							placeholder="Add to the discussion…"
							class="mono-focus resize-none border-0 bg-transparent px-0 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--faint)] shadow-none focus-visible:border-0 focus-visible:ring-0 dark:border-0 dark:bg-transparent"
						/>
					</div>
					<div class="mt-2 flex justify-end">
						<button
							type="submit"
							disabled={!commentDraft.trim()}
							class="mono-focus border border-[var(--accent)] px-3.5 py-1.5 text-[12px] tracking-tight text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--ground)] disabled:pointer-events-none disabled:opacity-40"
						>Comment</button>
					</div>
				</form>
			{:else if data.interactionsLocked}
				<p class="flex items-center gap-2 text-[13px] text-[var(--faint)]"><Lock size={14} /> This one's been decided — the thread is closed, but the votes are part of history.</p>
			{:else if !data.signedIn}
				<p class="text-[13px] text-[var(--dim)]"><a href={loginHref} class="mono-focus text-[var(--accent)] transition-colors hover:underline">Sign in</a> to join in — it takes one click.</p>
			{:else}
				<p class="text-[13px] text-[var(--faint)]">Comments are not open on this project.</p>
			{/if}
		</div>
	</section>
</main>
