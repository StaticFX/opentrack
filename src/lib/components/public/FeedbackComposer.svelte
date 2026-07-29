<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Send, Sparkles } from '@lucide/svelte';
	import { announce } from '$lib/announce';
	import UpvoteButton from '$lib/components/UpvoteButton.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { SUGGESTION_KINDS, type SuggestionKind } from '$lib/constants';
	import { SUGGESTION_KIND_META } from '$lib/suggestionKind';
	import { SUGGESTION_STATUS_META } from '$lib/suggestionStatus';
	import { cn } from '$lib/utils/cn';

	type Similar = { id: string; title: string; kind: string; status: string; votes: number };
	type Props = {
		projectId: string;
		base: string;
		canSubmit: boolean;
		error?: string | null;
		initialTitle?: string;
	};
	let { projectId, base, canSubmit, error = null, initialTitle = '' }: Props = $props();

	const kindCopy: Record<string, { prompt: string; placeholder: string; detail: string }> = {
		suggestion: {
			prompt: 'What would make this better?',
			placeholder: 'It would be great if…',
			detail: 'Why would this help? Any details welcome (optional)'
		},
		bug: {
			prompt: 'What went wrong?',
			placeholder: 'When I do X, Y happens instead of…',
			detail: 'Steps to reproduce, what you expected to happen… (optional)'
		}
	};

	let kind = $state<SuggestionKind>('suggestion');
	let title = $state(initialTitle);
	let body = $state('');
	let expanded = $state(!!error || !!initialTitle);
	let titleEl = $state<HTMLElement | null>(null);

	// ---- Dedupe-before-post -----------------------------------------------
	let similar = $state<Similar[]>([]);
	let similarTickets = $state<Array<{ number: number; title: string; closed: boolean }>>([]);
	let dismissed = $state(false);
	let backedIds = $state<string[]>([]);
	let reqId = 0;

	$effect(() => {
		const term = title.trim();
		if (!expanded || dismissed || term.length < 3) {
			similar = [];
			similarTickets = [];
			return;
		}
		const id = ++reqId;
		const t = setTimeout(async () => {
			try {
				const res = await fetch(`/api/public/projects/${projectId}/search?q=${encodeURIComponent(term)}`);
				if (!res.ok || id !== reqId) return;
				const d = await res.json();
				if (id !== reqId) return;
				similar = (d.suggestions ?? []).slice(0, 4);
				similarTickets = (d.tickets ?? []).slice(0, 2);
				const n = similar.length + similarTickets.length;
				if (n) announce(`${n} similar ${n === 1 ? 'item' : 'items'} found`);
			} catch {
				/* ignore */
			}
		}, 250);
		return () => clearTimeout(t);
	});

	const DRAFT_KEY = $derived(`ot-draft:${projectId}`);
	let draftRestored = $state(false);

	function stashDraft() {
		try {
			sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ kind, title, body }));
		} catch {
			/* fine */
		}
	}

	onMount(() => {
		// Returning from a dedupe click? Restore the draft.
		try {
			const raw = sessionStorage.getItem(DRAFT_KEY);
			if (raw && !title) {
				const d = JSON.parse(raw);
				kind = SUGGESTION_KINDS.includes(d.kind) ? d.kind : 'suggestion';
				title = d.title ?? '';
				body = d.body ?? '';
				if (title) {
					expanded = true;
					draftRestored = true;
					setTimeout(() => (draftRestored = false), 2500);
				}
				sessionStorage.removeItem(DRAFT_KEY);
			}
		} catch {
			/* fine */
		}
	});

	// React to ?title=/#post on EVERY navigation — the palette's "post it as
	// feedback" handoff can land while this component instance is already
	// mounted (same-route nav), so onMount alone would miss it.
	let lastHref = '';
	$effect(() => {
		const href = page.url.href;
		if (href === lastHref) return;
		lastHref = href;
		const t = page.url.searchParams.get('title');
		if (t) {
			title = t;
			dismissed = false;
		}
		if (t || page.url.hash === '#post') {
			expanded = true;
			setTimeout(() => (titleEl?.querySelector('input') as HTMLInputElement | null)?.focus(), 50);
		}
	});

	const loginHref = $derived(
		`/auth/login?redirect=${encodeURIComponent(`${page.url.pathname}#post`)}`
	);
</script>

<div class="mono-composer" id="post">
	{#if canSubmit}
		<form method="POST" action="?/submit" use:enhance class="ot-rise">
			<input type="hidden" name="kind" value={kind} />
			<div class="flex flex-wrap items-center justify-between gap-3">
				<h2 class="mono-display text-lg text-[var(--text)]">{kindCopy[kind].prompt}</h2>
				<div class="flex gap-2">
					{#each SUGGESTION_KINDS as k (k)}
						{@const meta = SUGGESTION_KIND_META[k]}
						{@const Icon = meta.icon}
						<button
							type="button"
							onclick={() => (kind = k)}
							aria-pressed={kind === k}
							class={cn(
								'mono-focus flex items-center gap-1.5 border px-3 py-1 text-[12px] transition-colors',
								kind === k
									? 'border-[var(--accent)] text-[var(--accent)]'
									: 'border-[var(--rule)] text-[var(--dim)] hover:text-[var(--text)]'
							)}
						>
							<Icon size={13} /> {meta.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="mt-4" bind:this={titleEl}>
				<Input
					name="title"
					bind:value={title}
					placeholder={kindCopy[kind].placeholder}
					required
					onfocus={() => (expanded = true)}
				/>
				{#if error}<p class="mt-1.5 text-[12px] text-[var(--amber)]">{error}</p>{/if}
				{#if draftRestored}<p class="mt-1.5 text-[11px] text-[var(--accent)]">Draft restored</p>{/if}
			</div>

			<!-- Reveal via grid-rows so height animates without JS measurement. -->
			<div class={cn('grid transition-all duration-200 ease-[var(--ease-out-quint)]', expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
				<div class="min-h-0 overflow-hidden">
					{#if (similar.length || similarTickets.length) && !dismissed}
						<!-- Announced via the shared LiveRegion (announce()), not a second live region. -->
						<div class="mt-4 border-t border-[var(--rule)] pt-3">
							<div class="flex items-baseline justify-between gap-2">
								<p class="text-[11px] tracking-[0.14em] text-[var(--faint)] uppercase">
									// sound familiar? a vote beats a duplicate
								</p>
								<button type="button" onclick={() => (dismissed = true)} class="mono-focus shrink-0 text-[11px] text-[var(--faint)] transition-colors hover:text-[var(--dim)]">
									none of these — keep writing
								</button>
							</div>
							<div class="mt-2.5 space-y-1.5">
								{#each similar as sim (sim.id)}
									{@const kindMeta = SUGGESTION_KIND_META[sim.kind as keyof typeof SUGGESTION_KIND_META]}
									{@const KindIcon = kindMeta?.icon}
									<div class="flex items-center gap-2.5">
										<UpvoteButton
											subjectType="suggestion"
											id={sim.id}
											count={sim.votes}
											layout="row"
											onvote={(voted) => {
												if (voted && !backedIds.includes(sim.id)) backedIds = [...backedIds, sim.id];
											}}
										/>
										<a
											href={`${base}/suggestions/${sim.id}`}
											onclick={stashDraft}
											class="mono-focus min-w-0 flex-1"
										>
											<span class="flex items-center gap-1.5 truncate text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">
												{#if KindIcon}<KindIcon size={12} style={`color:${kindMeta.color}`} class="shrink-0" />{/if}
												<span class="truncate">{sim.title}</span>
												{#if sim.status !== 'open'}
													<span class="shrink-0 text-[10px] tracking-wide uppercase" style={`color:${SUGGESTION_STATUS_META[sim.status as keyof typeof SUGGESTION_STATUS_META]?.color}`}>{SUGGESTION_STATUS_META[sim.status as keyof typeof SUGGESTION_STATUS_META]?.label}</span>
												{/if}
											</span>
											{#if backedIds.includes(sim.id)}
												<span class="text-[11px] text-[var(--accent)]">Backed. You can still post yours if it's different.</span>
											{/if}
										</a>
									</div>
								{/each}
								{#each similarTickets as tk (tk.number)}
									<a href={`${base}/t/${tk.number}`} onclick={stashDraft} class="mono-focus flex items-center gap-2 py-1 text-[14px] text-[var(--dim)] transition-colors hover:text-[var(--accent)]">
										<span class="tabular-nums text-[var(--faint)]">#{tk.number}</span>
										<span class="min-w-0 flex-1 truncate text-[var(--text)]">{tk.title}</span>
										<span class="shrink-0 text-[10px] tabular-nums text-[var(--faint)]">{tk.closed ? 'already shipped' : 'already tracked'}</span>
									</a>
								{/each}
							</div>
						</div>
					{/if}

					<div class="mt-4"><Textarea name="body" bind:value={body} rows={3} placeholder={kindCopy[kind].detail} /></div>
					<div class="mt-4 flex items-center justify-between gap-2">
						<p class="hidden text-[12px] text-[var(--faint)] sm:block">Posting as you — others can vote and comment.</p>
						<Button variant="accent" type="submit" disabled={!title.trim()} class="mono-cta ml-auto">
							<Send size={14} /> Post {kind === 'bug' ? 'bug report' : 'idea'}
						</Button>
					</div>
				</div>
			</div>
		</form>
	{:else}
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 class="mono-display text-lg text-[var(--text)]">Have an idea? Spotted a bug?</h2>
				<p class="mt-1 text-[12px] text-[var(--dim)]">
					Sign in to join in — it takes one click. Upvoting works without an account.
				</p>
			</div>
			<Button variant="accent" size="sm" href={loginHref} class="mono-cta">
				<Sparkles size={13} /> Sign in
			</Button>
		</div>
	{/if}
</div>

<style>
	/* The shared Input/Textarea/Button carry the app's light/dark chrome; inside
	   the composer we recolour their real elements to the flat mono language. The
	   selectors out-specify Tailwind's theme utilities (incl. dark: variants), so
	   no !important is needed. */
	.mono-composer :global(input),
	.mono-composer :global(textarea) {
		border-radius: 3px;
		border-color: var(--rule);
		background: var(--raised);
		color: var(--text);
		font-family: var(--font-jb);
		font-size: 14px;
	}
	.mono-composer :global(input)::placeholder,
	.mono-composer :global(textarea)::placeholder {
		color: var(--faint);
	}
	.mono-composer :global(input:focus-visible),
	.mono-composer :global(textarea:focus-visible) {
		border-color: var(--accent);
		outline: none;
		box-shadow: 0 0 0 1px var(--accent);
	}

	/* The one primary action per view — flat cobalt, mono type. */
	.mono-composer :global(.mono-cta) {
		border-radius: 3px;
		background: var(--accent);
		color: var(--ground);
		font-family: var(--font-jb);
		font-weight: 400;
	}
	.mono-composer :global(.mono-cta:hover:not(:disabled)) {
		background: color-mix(in srgb, var(--accent) 88%, white);
	}
</style>
