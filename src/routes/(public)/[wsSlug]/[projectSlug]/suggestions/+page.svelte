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

	const RANK_STYLE = [
		'background:color-mix(in oklab, #eab308 16%, transparent);color:#a16207',
		'background:color-mix(in oklab, #94a3b8 18%, transparent);color:#64748b',
		'background:color-mix(in oklab, #d97706 14%, transparent);color:#b45309'
	];
	const MILESTONES = [100, 50, 25, 10];
	const backerPill = (votes: number) => MILESTONES.find((m) => votes >= m) ?? null;

	const filtered = $derived(data.status !== 'all' || !!data.kind || data.mine);
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

	<!-- Controls -->
	<div class="mt-6 mb-4 flex flex-wrap items-center gap-2">
		<div class="flex gap-0.5 rounded-full border border-black/5 bg-white/70 p-0.5 dark:border-white/5 dark:bg-neutral-800/70">
			{#each sorts as s (s.key)}
				{@const Icon = s.icon}
				<button
					onclick={() => go({ sort: s.key })}
					aria-pressed={data.sort === s.key}
					class={cn(
						'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
						data.sort === s.key
							? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
							: 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
					)}
				>
					<Icon size={13} /> {s.label}
				</button>
			{/each}
		</div>

		<div class="flex gap-0.5 rounded-full border border-black/5 bg-white/70 p-0.5 dark:border-white/5 dark:bg-neutral-800/70">
			{#each kindFilters as k (k.key)}
				<button
					onclick={() => go({ kind: k.key })}
					aria-pressed={(data.kind ?? '') === k.key}
					class={cn(
						'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
						(data.kind ?? '') === k.key
							? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
							: 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
					)}
				>{k.label}</button>
			{/each}
			{#if data.canSubmit}
				<button
					onclick={() => go({ mine: data.mine ? '' : '1' })}
					aria-pressed={data.mine}
					class={cn(
						'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
						data.mine
							? 'bg-[var(--accent-solid)] text-white shadow-sm'
							: 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
					)}
				>Mine</button>
			{/if}
		</div>

		<div class="ml-auto flex items-center gap-2">
			<Select value={data.status} options={statusOptions} class="w-36" onchange={(v) => go({ status: v })} />
			<a href={`${base}/rss.xml`} class="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-black/5 hover:text-orange-500 dark:hover:bg-white/10" title="RSS feed" aria-label="RSS feed">
				<Rss size={14} />
			</a>
		</div>
	</div>

	<!-- List -->
	<div class="space-y-2.5">
		{#each data.suggestions as s, i (s.id)}
			{@const kindMeta = SUGGESTION_KIND_META[s.kind]}
			{@const KindIcon = kindMeta.icon}
			{@const statusMeta = SUGGESTION_STATUS_META[s.status]}
			{@const rank = data.topIds.indexOf(s.id)}
			{@const pill = backerPill(s.votes)}
			<!-- Stretched-link card: the title anchor covers the card via ::before,
			     so the author link and vote button stay valid, separate interactives. -->
			<div
				class="pub-card ot-rise group relative flex items-start gap-3.5 p-3.5 transition duration-150 hover:-translate-y-0.5"
				style={`--rise-i:${i}; view-transition-name: s-${s.id.slice(0, 8)}`}
			>
				<div class="relative z-10 shrink-0">
					<UpvoteButton subjectType="suggestion" id={s.id} count={s.votes} voted={s.voted} locked={!data.isMember && s.status !== 'open'} />
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
						<span
							class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
							style={`background:color-mix(in oklab, ${kindMeta.color} 12%, transparent);color:${kindMeta.color}`}
						><KindIcon size={11} /> {kindMeta.label}</span>
						{#if rank >= 0 && s.status === 'open'}
							<span class="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold" style={RANK_STYLE[rank]}>#{rank + 1} requested</span>
						{/if}
						{#if s.status !== 'open'}
							<span
								class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
								style={`background:color-mix(in oklab, ${statusMeta.color} 12%, transparent);color:${statusMeta.color}`}
							>{statusMeta.label}</span>
						{/if}
						{#if pill}
							<span class="rounded-full bg-amber-500/12 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">{pill}+ backers</span>
						{/if}
					</div>
					<a
						href={`${base}/${s.id}`}
						class="mt-1 block font-semibold tracking-tight text-neutral-800 before:absolute before:inset-0 before:content-[''] group-hover:text-neutral-950 dark:text-neutral-100 dark:group-hover:text-white"
					>{s.title}</a>
					{#if s.body}<p class="mt-0.5 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">{s.body}</p>{/if}
					<div class="mt-2 flex items-center gap-3 text-xs text-neutral-400">
						{#if s.authorName}
							<span class="flex items-center gap-1.5">
								{#if s.authorAvatar}
									<img src={s.authorAvatar} alt="" class="size-4 rounded-full" />
								{/if}
								{#if s.authorUsername}
									<a href={`/u/${s.authorUsername}`} class="relative z-10 hover:text-neutral-600 hover:underline dark:hover:text-neutral-300">{s.authorName}</a>
								{:else}
									{s.authorName}
								{/if}
							</span>
						{/if}
						{#if s.comments > 0}<span class="flex items-center gap-1"><MessageSquare size={12} /> {s.comments}</span>{/if}
					</div>
				</div>
			</div>
		{:else}
			<div class="pub-card rounded-3xl">
				<EmptyState
					icon={Inbox}
					title={filtered ? 'Nothing matches these filters' : 'Every project starts with idea #1'}
					body={filtered ? 'Try widening them — good ideas hide in odd corners.' : 'Make it yours — the composer is right above.'}
				/>
			</div>
		{/each}
	</div>
</main>
