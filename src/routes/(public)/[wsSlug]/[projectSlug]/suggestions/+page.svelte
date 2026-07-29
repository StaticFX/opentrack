<script lang="ts">
	import { goto } from '$app/navigation';
	import { MessageSquare, Trophy, Sparkles, TrendingUp, Inbox, Rss } from '@lucide/svelte';
	import { SUGGESTION_STATUSES, SUGGESTION_KINDS } from '$lib/constants';
	import { SUGGESTION_STATUS_META } from '$lib/suggestionStatus';
	import { SUGGESTION_KIND_META } from '$lib/suggestionKind';
	import EmptyState from '$lib/components/public/EmptyState.svelte';
	import FeedbackComposer from '$lib/components/public/FeedbackComposer.svelte';
	import PublicMeta from '$lib/components/public/PublicMeta.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import UpvoteButton from '$lib/components/UpvoteButton.svelte';
	import { ago } from '$lib/time';
	import { cn } from '$lib/utils/cn';

	let { data, form } = $props();

	const base = $derived(`/${data.workspace.slug}/${data.project.slug}/suggestions`);
	const sorts = [
		{ key: 'top', label: 'Top', icon: Trophy },
		{ key: 'new', label: 'New', icon: Sparkles },
		{ key: 'trending', label: 'Trending', icon: TrendingUp }
	];
	const statusOptions = [
		{ value: 'all', label: 'All statuses' },
		...SUGGESTION_STATUSES.map((s) => ({ value: s, label: SUGGESTION_STATUS_META[s].label }))
	];
	const kindFilters = [
		{ key: '', label: 'Everything' },
		...SUGGESTION_KINDS.map((k) => ({ key: k, label: `${SUGGESTION_KIND_META[k].label}s` }))
	];

	function go(params: Record<string, string>) {
		const sp = new URLSearchParams({ sort: data.sort, status: data.status });
		if (data.kind) sp.set('kind', data.kind);
		if (data.mine) sp.set('mine', '1');
		for (const [k, v] of Object.entries(params)) {
			if (v) sp.set(k, v);
			else sp.delete(k);
		}
		goto(`${base}?${sp}`, { noScroll: true });
	}

	const MILESTONES = [100, 50, 25, 10];
	const backerPill = (votes: number) => MILESTONES.find((m) => votes >= m) ?? null;

	const filtered = $derived(data.status !== 'all' || !!data.kind || data.mine);

	// One toggle vocabulary for the sort / kind / mine filters — a hairline
	// border, cobalt when active. Mirrors FeedbackComposer's kind picker.
	const filterBtn = (active: boolean) =>
		cn(
			'mono-focus flex items-center gap-1.5 border px-2.5 py-1 text-[12px] tracking-tight transition-colors',
			active ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--rule)] text-[var(--dim)] hover:text-[var(--text)]'
		);
</script>

<PublicMeta
	title={`${data.project.name} — ideas & bug reports`}
	description={`Share an idea, report a bug, or vote on what ships next for ${data.project.name}.`}
/>

<svelte:head>
	<link rel="alternate" type="application/rss+xml" title={`${data.project.name} feedback`} href={`${base}/rss.xml`} />
</svelte:head>

<main class="mx-auto max-w-3xl px-4 py-6 sm:px-6">
	<FeedbackComposer
		projectId={data.project.id}
		base={`/${data.workspace.slug}/${data.project.slug}`}
		canSubmit={data.canSubmit}
		error={form?.error}
		initialTitle={form?.title || data.initialTitle}
	/>

	<!-- Section label + controls -->
	<div class="mt-10 flex flex-wrap items-end justify-between gap-3 border-t border-[var(--rule)] pt-6">
		<p class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Browse feedback</p>
		<a
			href={`${base}/rss.xml`}
			class="mono-focus flex items-center gap-1.5 text-[11px] tracking-tight text-[var(--faint)] transition-colors hover:text-[var(--accent)]"
		>
			<Rss size={12} /> RSS
		</a>
	</div>

	<div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2.5">
		<div class="flex flex-wrap items-center gap-1.5">
			{#each sorts as s (s.key)}
				{@const Icon = s.icon}
				<button onclick={() => go({ sort: s.key })} aria-pressed={data.sort === s.key} class={filterBtn(data.sort === s.key)}>
					<Icon size={12} /> {s.label}
				</button>
			{/each}
		</div>

		<span class="hidden h-4 w-px bg-[var(--rule)] sm:block" aria-hidden="true"></span>

		<div class="flex flex-wrap items-center gap-1.5">
			{#each kindFilters as k (k.key)}
				<button onclick={() => go({ kind: k.key })} aria-pressed={(data.kind ?? '') === k.key} class={filterBtn((data.kind ?? '') === k.key)}>
					{k.label}
				</button>
			{/each}
			{#if data.canSubmit}
				<button onclick={() => go({ mine: data.mine ? '' : '1' })} aria-pressed={data.mine} class={filterBtn(!!data.mine)}>
					Mine
				</button>
			{/if}
		</div>

		<div class="mono-select ml-auto">
			<Select value={data.status} options={statusOptions} size="sm" class="w-36" onchange={(v) => go({ status: v })} />
		</div>
	</div>

	<!-- List -->
	<ul class="mt-6 border-t border-[var(--rule)]">
		{#each data.suggestions as s, i (s.id)}
			{@const kindMeta = SUGGESTION_KIND_META[s.kind]}
			{@const KindIcon = kindMeta.icon}
			{@const statusMeta = SUGGESTION_STATUS_META[s.status]}
			{@const rank = data.topIds.indexOf(s.id)}
			{@const pill = backerPill(s.votes)}
			<li class="ot-rise border-b border-[var(--rule)]" style={`--rise-i:${i}; view-transition-name: s-${s.id.slice(0, 8)}`}>
				<div class="flex items-start gap-3 py-3.5">
					<span class="vote-mono mt-0.5 shrink-0">
						<UpvoteButton
							subjectType="suggestion"
							id={s.id}
							count={s.votes}
							voted={s.voted}
							locked={!data.isMember && s.status !== 'open'}
							layout="row"
						/>
					</span>
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
							<KindIcon size={13} class="shrink-0" style={`color:${kindMeta.color}`} aria-hidden="true" />
							<a
								href={`${base}/${s.id}`}
								class="mono-focus min-w-0 truncate text-[14px] tracking-tight text-[var(--text)] transition-colors hover:text-[var(--accent)]"
							>{s.title}</a>
							{#if s.status !== 'open'}
								<span class="shrink-0 text-[10px] tracking-wide uppercase" style={`color:${statusMeta.color}`}>{statusMeta.label}</span>
							{/if}
						</div>
						{#if s.body}<p class="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[var(--dim)]">{s.body}</p>{/if}
						<p class="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] tabular-nums text-[var(--faint)]">
							{#if rank >= 0 && s.status === 'open'}<span>#{rank + 1} requested</span><span aria-hidden="true">·</span>{/if}
							{#if pill}<span>{pill}+ backers</span><span aria-hidden="true">·</span>{/if}
							{#if s.authorName}
								<span class="flex items-center gap-1">
									{#if s.authorAvatar}<img src={s.authorAvatar} alt="" class="size-3.5 rounded-full" />{/if}
									{#if s.authorUsername}
										<a href={`/u/${s.authorUsername}`} class="mono-focus transition-colors hover:text-[var(--accent)]">{s.authorName}</a>
									{:else}
										{s.authorName}
									{/if}
								</span>
								<span aria-hidden="true">·</span>
							{/if}
							<span>{ago(s.createdAt)}</span>
							{#if s.comments > 0}
								<span aria-hidden="true">·</span>
								<span class="flex items-center gap-1"><MessageSquare size={11} /> {s.comments}</span>
							{/if}
						</p>
					</div>
				</div>
			</li>
		{:else}
			<li class="border-b border-[var(--rule)]">
				<EmptyState
					icon={Inbox}
					title={filtered ? 'Nothing matches these filters' : 'Every project starts with idea #1'}
					body={filtered ? 'Try widening them — good ideas hide in odd corners.' : 'Make it yours — the composer is right above.'}
				/>
			</li>
		{/each}
	</ul>
</main>

<style>
	/* Select is a shared, theme-following UI primitive (light/dark app chrome) —
	   recolour its real trigger + popover to the flat mono language without
	   touching the component, mirroring FeedbackComposer's input/textarea reskin. */
	.mono-select :global(button[role='combobox']) {
		border-radius: 2px;
		border-color: var(--rule);
		background: var(--raised);
		color: var(--dim);
		font-family: var(--font-jb);
	}
	.mono-select :global(button[role='combobox']:hover) {
		border-color: var(--accent);
		color: var(--text);
	}
	.mono-select :global(button[role='combobox']:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.mono-select :global(button[role='combobox'] svg) {
		color: var(--faint);
	}
	.mono-select :global([role='listbox']) {
		border-radius: 2px;
		border-color: var(--rule);
		background: var(--raised);
		box-shadow: none;
	}
	.mono-select :global([role='option']) {
		border-radius: 0;
		color: var(--dim);
	}
	.mono-select :global([role='option']:hover),
	.mono-select :global([role='option'].bg-neutral-100),
	.mono-select :global([role='option'].dark\:bg-neutral-800) {
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		color: var(--text);
	}
	.mono-select :global([role='option'] svg) {
		color: var(--accent);
	}
</style>
