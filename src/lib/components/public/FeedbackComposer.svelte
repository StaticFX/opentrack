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

<div class="pub-card ot-rise overflow-hidden rounded-3xl" id="post">
	{#if canSubmit}
		<form method="POST" action="?/submit" use:enhance class="p-4 sm:p-5">
			<input type="hidden" name="kind" value={kind} />
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h2 class="type-poster text-lg">{kindCopy[kind].prompt}</h2>
				<div class="flex gap-1 rounded-full bg-black/5 p-0.5 dark:bg-white/10">
					{#each SUGGESTION_KINDS as k (k)}
						{@const meta = SUGGESTION_KIND_META[k]}
						{@const Icon = meta.icon}
						<button
							type="button"
							onclick={() => (kind = k)}
							aria-pressed={kind === k}
							class={cn(
								'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all',
								kind === k
									? 'bg-white shadow-sm dark:bg-neutral-700'
									: 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
							)}
							style={kind === k ? `color:${meta.color}` : ''}
						>
							<Icon size={13} /> {meta.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="mt-3" bind:this={titleEl}>
				<Input
					name="title"
					bind:value={title}
					placeholder={kindCopy[kind].placeholder}
					required
					onfocus={() => (expanded = true)}
				/>
				{#if error}<p class="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>{/if}
				{#if draftRestored}<p class="mt-1.5 font-mono text-[11px] text-[var(--accent-fg)]">Draft restored</p>{/if}
			</div>

			<!-- Reveal via grid-rows so height animates without JS measurement. -->
			<div class={cn('grid transition-all duration-200 ease-[var(--ease-out-quint)]', expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
				<div class="min-h-0 overflow-hidden">
					{#if (similar.length || similarTickets.length) && !dismissed}
						<!-- Announced via the shared LiveRegion (announce()), not a second live region. -->
						<div class="mt-3 rounded-2xl bg-black/[0.03] p-3 dark:bg-white/[0.04]">
							<div class="flex items-baseline justify-between gap-2">
								<p class="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
									Sound familiar? A vote gets it there faster than a duplicate.
								</p>
								<button type="button" onclick={() => (dismissed = true)} class="shrink-0 text-[11px] font-medium text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
									None of these — keep writing
								</button>
							</div>
							<div class="mt-2 space-y-1.5">
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
											class="min-w-0 flex-1"
										>
											<span class="flex items-center gap-1.5 truncate text-sm font-medium hover:text-[var(--accent-fg)]">
												{#if KindIcon}<KindIcon size={12} style={`color:${kindMeta.color}`} class="shrink-0" />{/if}
												<span class="truncate">{sim.title}</span>
												{#if sim.status !== 'open'}
													<span class="shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold" style={`background:${SUGGESTION_STATUS_META[sim.status as keyof typeof SUGGESTION_STATUS_META]?.color}1e;color:${SUGGESTION_STATUS_META[sim.status as keyof typeof SUGGESTION_STATUS_META]?.color}`}>{SUGGESTION_STATUS_META[sim.status as keyof typeof SUGGESTION_STATUS_META]?.label}</span>
												{/if}
											</span>
											{#if backedIds.includes(sim.id)}
												<span class="font-mono text-[11px] text-[var(--accent-fg)]">Backed. You can still post yours if it's different.</span>
											{/if}
										</a>
									</div>
								{/each}
								{#each similarTickets as tk (tk.number)}
									<a href={`${base}/t/${tk.number}`} onclick={stashDraft} class="flex items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.06]">
										<span class="font-mono text-xs text-neutral-400">#{tk.number}</span>
										<span class="min-w-0 flex-1 truncate">{tk.title}</span>
										<span class="shrink-0 font-mono text-[10px] text-neutral-400">{tk.closed ? 'already shipped' : 'already tracked'}</span>
									</a>
								{/each}
							</div>
						</div>
					{/if}

					<div class="mt-3"><Textarea name="body" bind:value={body} rows={3} placeholder={kindCopy[kind].detail} /></div>
					<div class="mt-3 flex items-center justify-between gap-2">
						<p class="hidden text-xs text-neutral-400 sm:block">Posting as you — others can vote and comment.</p>
						<Button variant="accent" type="submit" disabled={!title.trim()} class="ml-auto rounded-full px-4">
							<Send size={14} /> Post {kind === 'bug' ? 'bug report' : 'idea'}
						</Button>
					</div>
				</div>
			</div>
		</form>
	{:else}
		<div class="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
			<div>
				<h2 class="type-poster text-lg">Have an idea? Spotted a bug?</h2>
				<p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
					Sign in to join in — it takes one click. Upvoting works without an account.
				</p>
			</div>
			<Button variant="accent" size="sm" href={loginHref} class="rounded-full px-4">
				<Sparkles size={13} /> Sign in
			</Button>
		</div>
	{/if}
</div>
