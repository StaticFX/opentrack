<!--
	MonoFeedback — the "public by default" proof, try-it-now. The REAL top
	suggestions on the showcase project, each row wired to the REAL UpvoteButton
	(POSTs to /api/suggestions/:id/vote, deduped by browser for anonymous visitors).
	The button is reskinned to a mono `[▲ N]` counter but kept fully wired — clicking
	really votes and the count is real. No boxes: type on the ground, hairline rows.
-->
<script lang="ts">
	import UpvoteButton from '$lib/components/UpvoteButton.svelte';
	import { SUGGESTION_STATUS_META } from '$lib/suggestionStatus';
	import type { SuggestionStatus } from '$lib/constants';
	import { ago } from '$lib/time';
	import type { LandSuggestion } from './types';

	type Props = { suggestions: LandSuggestion[]; base: string; projectName: string };
	let { suggestions, base, projectName }: Props = $props();

	const feedbackUrl = $derived(`${base}/suggestions`);
	// The first still-open card gets the "try it" nudge — the votable moment.
	const firstOpenId = $derived(suggestions.find((s) => s.status === 'open')?.id ?? null);
</script>

<section id="feedback" class="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
	<p class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">01 // Feedback</p>
	<div class="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
		<h2 class="mono-display max-w-xl text-2xl leading-tight tracking-tight text-[var(--text)] sm:text-4xl">
			Let people vote on what's next.
		</h2>
		<a
			href={feedbackUrl}
			class="mono-focus shrink-0 text-[13px] tracking-tight text-[var(--dim)] transition-colors hover:text-[var(--accent)]"
		>
			Open the feedback board →
		</a>
	</div>
	<p class="mt-4 max-w-2xl text-[14px] leading-relaxed text-[var(--dim)]">
		These are live suggestions on <span class="text-[var(--text)]">{projectName}</span>. Anyone can
		upvote — deduped by browser, no sign-up. Try one; the count is real.
	</p>

	<ul class="mt-10 border-t border-[var(--rule)]">
		{#each suggestions as s (s.id)}
			{@const statusMeta = SUGGESTION_STATUS_META[s.status as SuggestionStatus]}
			<li class="flex items-center gap-4 border-b border-[var(--rule)] py-3.5">
				<span class="vote-mono shrink-0">
					<UpvoteButton
						subjectType="suggestion"
						id={s.id}
						count={s.votes}
						voted={s.voted}
						locked={s.status !== 'open'}
						layout="row"
					/>
				</span>
				<div class="min-w-0 flex-1">
					<a
						href={`${feedbackUrl}/${s.id}`}
						class="mono-focus block truncate text-[15px] tracking-tight text-[var(--text)] transition-colors hover:text-[var(--accent)]"
					>
						{s.title}
					</a>
					<p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--faint)]">
						{#if s.authorName}<span>{s.authorName}</span><span aria-hidden="true">·</span>{/if}
						<span>{ago(s.createdAt)}</span>
						{#if s.comments > 0}
							<span aria-hidden="true">·</span><span>{s.comments} {s.comments === 1 ? 'reply' : 'replies'}</span>
						{/if}
						{#if s.id === firstOpenId}
							<span aria-hidden="true">·</span><span class="text-[var(--accent)]">← try it, no login</span>
						{/if}
					</p>
				</div>
				{#if s.status !== 'open' && statusMeta}
					<span
						class="shrink-0 text-[11px] tracking-wide uppercase"
						style={`color:${statusMeta.color}`}>{statusMeta.label}</span
					>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<style>
	/* Reskin the reused UpvoteButton to a flat mono `[▲ N]` counter without
	   touching the component. It stays the real click target (it does the fetch);
	   we only override its visual layer. `!important` beats the component's inline
	   voted-state gradient background — the mono page bans gradients. */
	.vote-mono {
		display: inline-flex;
		align-items: center;
		font-family: var(--font-jb);
		color: var(--faint);
	}
	.vote-mono::before {
		content: '[';
		margin-right: 3px;
	}
	.vote-mono::after {
		content: ']';
		margin-left: 3px;
	}
	.vote-mono :global(button) {
		min-width: 3.4rem;
		gap: 4px;
		border: 1px solid var(--rule);
		border-radius: 3px;
		background: transparent !important;
		padding: 3px 8px;
		font-family: var(--font-jb);
		font-size: 13px;
		font-weight: 400;
		letter-spacing: 0;
		color: var(--dim);
		box-shadow: none !important;
		transform: none !important;
		transition: color 0.15s, border-color 0.15s;
	}
	.vote-mono :global(button:hover:not(:disabled)) {
		border-color: var(--accent);
		color: var(--accent);
	}
	.vote-mono :global(button[aria-pressed='true']) {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 55%, transparent);
	}
	.vote-mono :global(button:disabled) {
		opacity: 0.5;
	}
	.vote-mono :global(button:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	/* Swap the lucide chevron for a solid ▲ so the counter reads exactly `[▲ N]`. */
	.vote-mono :global(button svg) {
		display: none;
	}
	.vote-mono :global(button)::before {
		content: '▲';
		font-size: 9px;
		line-height: 1;
	}
</style>
