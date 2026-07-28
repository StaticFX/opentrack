<script lang="ts">
	import {
		ArrowRight,
		CircleCheckBig,
		CircleDot,
		Hammer,
		Lightbulb,
		MessageSquare,
		Milestone,
		PackageOpen,
		Rocket,
		Sparkles,
		Tag
	} from '@lucide/svelte';
	import { liveInvalidate } from '$lib/client/live';
	import EmptyState from '$lib/components/public/EmptyState.svelte';
	import Heartbeat from '$lib/components/public/Heartbeat.svelte';
	import PublicMeta from '$lib/components/public/PublicMeta.svelte';
	import StatTile from '$lib/components/public/StatTile.svelte';
	import UpvoteButton from '$lib/components/UpvoteButton.svelte';
	import { renderMarkdown } from '$lib/markdown';
	import { ago } from '$lib/time';

	let { data } = $props();

	const base = $derived(`/${data.workspace.slug}/${data.project.slug}`);
	let beat = $state(0);

	// Live: board events (anon-capable) + project events (suggestions) both
	// funnel into one lazy invalidate; every raw event bumps the heartbeat dot.
	// $derived ids memoize by value so the invalidates these events trigger
	// don't tear down and reopen the EventSources every cycle.
	const liveProjectId = $derived(data.project.id);
	const liveBoardId = $derived(data.boardId);
	$effect(() => {
		const key = `public:overview:${liveProjectId}`;
		const opts = { debounce: 1500, maxWait: 5000, onEvent: () => beat++ };
		const stops = [
			liveBoardId ? liveInvalidate(`/api/sse/board/${liveBoardId}`, key, opts) : null,
			liveInvalidate(`/api/sse/project/${liveProjectId}`, key, opts)
		];
		return () => stops.forEach((s) => s?.());
	});

	const s = $derived(data.pulse.stats);
	const isEmpty = $derived(
		s.totalTickets === 0 && data.ideas.length === 0 && !data.latestRelease && data.activity.length === 0
	);

	const metaDesc = $derived(
		data.project.description ||
			`${s.openTickets} open · ${s.closedTickets} shipped · ${s.openIdeas} ideas waiting. Follow ${data.project.name} being built in the open.`
	);

	type Activity = (typeof data.activity)[number];
	function actLine(a: Activity): { text: string; href: string | null; icon: typeof CircleDot } {
		const who = a.actorName ?? 'Someone';
		const t = a.ticketNumber != null ? `#${a.ticketNumber}` : '';
		switch (a.type) {
			case 'ticket.created':
				return { text: `${who} opened ${t} ${a.ticketTitle ?? ''}`, href: a.ticketNumber != null ? `${base}/t/${a.ticketNumber}` : null, icon: CircleDot };
			case 'ticket.closed':
				return { text: `${who} shipped ${t} ${a.ticketTitle ?? ''}`, href: a.ticketNumber != null ? `${base}/t/${a.ticketNumber}` : null, icon: CircleCheckBig };
			case 'ticket.commented':
				return { text: `${who} commented on ${t} ${a.ticketTitle ?? ''}`, href: a.ticketNumber != null ? `${base}/t/${a.ticketNumber}` : null, icon: MessageSquare };
			case 'suggestion.created':
				return { text: `${who} shared “${a.suggestionTitle ?? 'an idea'}”`, href: a.suggestionId ? `${base}/suggestions/${a.suggestionId}` : null, icon: Lightbulb };
			case 'suggestion.status':
				return { text: `“${a.suggestionTitle ?? 'An idea'}” got a decision`, href: a.suggestionId ? `${base}/suggestions/${a.suggestionId}` : null, icon: Sparkles };
			case 'suggestion.commented':
				return { text: `${who} commented on “${a.suggestionTitle ?? 'an idea'}”`, href: a.suggestionId ? `${base}/suggestions/${a.suggestionId}` : null, icon: MessageSquare };
			case 'release.published':
				return { text: `${who} shipped ${a.releaseVersion ?? 'a release'} 🎉`, href: `${base}/releases`, icon: Tag };
			default:
				return { text: `${who} did something`, href: null, icon: CircleDot };
		}
	}

	const msProgress = (m: { openCount: number; closedCount: number }) => {
		const total = m.openCount + m.closedCount;
		return total ? Math.round((m.closedCount / total) * 100) : 0;
	};
</script>

<PublicMeta title={data.project.name} description={metaDesc} />

<main class="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
	{#if isEmpty}
		<div class="pub-card mt-8 rounded-3xl">
			<EmptyState icon={Sparkles} title="The workshop just opened" body="Nothing on the wall yet — but the front door is open. Ideas and bug reports shape what gets built first.">
				<a
					href={`${base}/suggestions#post`}
					class="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-solid)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--accent-solid-hover)]"
				>
					<Lightbulb size={15} /> Share the first idea
				</a>
			</EmptyState>
		</div>
	{:else}
		<!-- Pulse band -->
		<section class="mt-5 grid gap-4 lg:grid-cols-12">
			<div class="pub-card ot-rise rounded-3xl p-5 lg:col-span-7" style="--rise-i:0">
				<div class="flex items-baseline justify-between gap-3">
					<h2 class="pub-label flex items-center gap-1.5">
						<span class="relative flex size-2">
							<span class="absolute inline-flex size-full rounded-full bg-[var(--accent)] opacity-60 {beat > 0 ? 'ot-breathe' : ''}"></span>
							<span class="relative inline-flex size-2 rounded-full bg-[var(--accent)]"></span>
						</span>
						Pulse
					</h2>
					{#if data.pulse.lastActivityAt}
						<span class="font-mono text-[11px] text-neutral-400">last activity {ago(data.pulse.lastActivityAt)}</span>
					{/if}
				</div>
				<div class="mt-3">
					<Heartbeat weekly={data.pulse.weekly} {beat} />
				</div>
				<p class="mt-2 font-mono text-[11px] text-neutral-400 dark:text-neutral-500">
					{data.pulse.velocity.openedLast30d} opened · {data.pulse.velocity.closedLast30d} shipped in the last 30 days
				</p>
			</div>

			<div class="grid grid-cols-2 gap-4 lg:col-span-5">
				<StatTile value={s.openTickets} label="Open" accent />
				<StatTile value={s.closedTickets} label="Shipped" />
				<StatTile value={s.openIdeas} label="Ideas waiting" />
				<StatTile value={s.contributors} label="Contributors" />
			</div>
		</section>

		<div class="mt-8 grid gap-x-8 gap-y-10 lg:grid-cols-12">
			<div class="space-y-10 lg:col-span-7">
				<!-- Now building -->
				{#if data.nowBuilding.length || data.milestones.length}
					<section>
						<div class="flex items-baseline justify-between">
							<h2 class="type-poster flex items-center gap-2 text-xl"><Hammer size={18} class="text-[var(--accent-fg)]" /> Now building</h2>
							<a href={`${base}/board`} class="flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-[var(--accent-fg)]">full board <ArrowRight size={12} /></a>
						</div>

						{#if data.milestones.length}
							<div class="mt-3 space-y-2.5">
								{#each data.milestones as m (m.id)}
									<div class="flex items-center gap-3">
										<Milestone size={14} class="shrink-0 text-neutral-400" />
										<span class="min-w-0 truncate text-sm font-medium">{m.title}</span>
										<div class="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
											<div class="h-full rounded-full transition-all duration-500" style={`width:${msProgress(m)}%;background:var(--accent)`}></div>
										</div>
										<span class="shrink-0 font-mono text-[11px] text-neutral-400">{msProgress(m)}%{m.dueDate ? ` · due ${new Date(m.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}</span>
									</div>
								{/each}
							</div>
						{/if}

						<div class="mt-3 space-y-2.5">
							{#each data.nowBuilding as t, i (t.id)}
								<a href={`${base}/t/${t.number}`} class="pub-card ot-rise group flex items-center gap-3 p-3.5 transition duration-150 hover:-translate-y-0.5" style={`--rise-i:${i}`}>
									<span class="size-2 shrink-0 rounded-full" style={`background:${t.columnColor}`} title={t.columnName}></span>
									<span class="shrink-0 font-mono text-xs text-neutral-400">#{t.number}</span>
									<span class="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-[var(--accent-fg)]">{t.title}</span>
									{#if t.assignees.length}
										<span class="flex shrink-0 -space-x-1.5">
											{#each t.assignees.slice(0, 3) as a (a.userId ?? a.githubLogin)}
												{#if a.avatarUrl}
													<img src={a.avatarUrl} alt={a.displayName} title={a.displayName} class="size-5 rounded-full ring-2 ring-white dark:ring-neutral-800" />
												{:else}
													<span class="grid size-5 place-items-center rounded-full bg-neutral-300 text-[9px] font-semibold text-neutral-700 ring-2 ring-white dark:bg-neutral-600 dark:text-neutral-100 dark:ring-neutral-800" title={a.displayName}>{a.displayName.slice(0, 1).toUpperCase()}</span>
												{/if}
											{/each}
										</span>
									{/if}
								</a>
							{:else}
								<p class="text-sm text-neutral-400">Nothing on the bench right now.</p>
							{/each}
						</div>
					</section>
				{/if}

				<!-- Recently shipped -->
				{#if data.shipped.length}
					<section>
						<h2 class="type-poster flex items-center gap-2 text-xl"><Rocket size={18} class="text-green-600 dark:text-green-400" /> Recently shipped</h2>
						<div class="mt-3 space-y-1">
							{#each data.shipped as t (t.id)}
								<a href={`${base}/t/${t.number}`} class="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
									<CircleCheckBig size={15} class="shrink-0 text-green-500" />
									<span class="shrink-0 font-mono text-xs text-neutral-400">#{t.number}</span>
									<span class="min-w-0 flex-1 truncate text-sm group-hover:text-neutral-950 dark:group-hover:text-white">{t.title}</span>
									{#each t.labels.slice(0, 2) as l (l.id)}
										<span class="hidden rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline" style={`background:color-mix(in oklab, ${l.color} 12%, transparent);color:${l.color}`}>{l.name}</span>
									{/each}
									<span class="shrink-0 font-mono text-[11px] text-neutral-400">{ago(t.closedAt)}</span>
								</a>
							{/each}
						</div>
					</section>
				{/if}

				<!-- Latest release -->
				{#if data.latestRelease}
					{@const r = data.latestRelease}
					<section class="pub-card rounded-3xl p-5">
						<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
							<h2 class="pub-label">Latest release</h2>
							<span class="ml-auto font-mono text-[11px] text-neutral-400">{r.releasedAt ? ago(r.releasedAt) : ''}</span>
						</div>
						<p class="type-poster mt-1.5 text-2xl">{r.version}{#if r.name}<span class="ml-2 font-sans text-base font-normal text-neutral-500 dark:text-neutral-400">{r.name}</span>{/if}</p>
						{#if r.notes}
							<div class="prose prose-sm dark:prose-invert mt-2 line-clamp-3 max-w-none opacity-80">{@html renderMarkdown(r.notes)}</div>
						{/if}
						<div class="mt-3 flex flex-wrap items-center gap-2">
							{#each r.links.slice(0, 2) as l (l.url)}
								<a href={l.url} target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-solid)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[var(--accent-solid-hover)]">
									<PackageOpen size={13} /> {l.label}
								</a>
							{/each}
							<a href={`${base}/releases`} class="ml-auto flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-[var(--accent-fg)]">
								all releases{#if r.ticketCount}<span class="font-mono">({r.ticketCount} shipped)</span>{/if} <ArrowRight size={12} />
							</a>
						</div>
					</section>
				{/if}
			</div>

			<div class="space-y-10 lg:col-span-5">
				<!-- Top ideas -->
				<section>
					<div class="flex items-baseline justify-between">
						<h2 class="type-poster flex items-center gap-2 text-xl"><Lightbulb size={18} class="text-[var(--accent-fg)]" /> Top ideas</h2>
						<a href={`${base}/suggestions`} class="flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-[var(--accent-fg)]">all feedback <ArrowRight size={12} /></a>
					</div>
					<div class="mt-3 space-y-2.5">
						{#each data.ideas as idea, i (idea.id)}
							<div class="pub-card ot-rise flex items-center gap-3 p-3" style={`--rise-i:${i}`}>
								<UpvoteButton subjectType="suggestion" id={idea.id} count={idea.votes} voted={idea.voted} layout="row" />
								<a href={`${base}/suggestions/${idea.id}`} class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium hover:text-[var(--accent-fg)]">{idea.title}</p>
									{#if idea.comments > 0}
										<p class="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-400"><MessageSquare size={11} /> {idea.comments}</p>
									{/if}
								</a>
							</div>
						{:else}
							<p class="text-sm text-neutral-400">No open ideas — the floor is yours.</p>
						{/each}
						<a
							href={`${base}/suggestions#post`}
							class="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-neutral-300 px-3 py-2.5 text-sm font-medium text-neutral-500 transition-colors hover:border-[var(--accent-border)] hover:text-[var(--accent-fg)] dark:border-neutral-700"
						>
							<Sparkles size={14} /> Share yours
						</a>
					</div>
				</section>

				<!-- Activity -->
				{#if data.activity.length}
					<section>
						<h2 class="pub-label">Recent activity</h2>
						<ol class="mt-3 space-y-0.5">
							{#each data.activity as a (a.id)}
								{@const line = actLine(a)}
								{@const Icon = line.icon}
								<li>
									<svelte:element
										this={line.href ? 'a' : 'div'}
										href={line.href ?? undefined}
										class="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 {line.href ? 'transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]' : ''}"
									>
										{#if a.actorAvatar}
											<img src={a.actorAvatar} alt="" class="mt-0.5 size-5 shrink-0 rounded-full" />
										{:else}
											<span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-black/5 text-neutral-400 dark:bg-white/10"><Icon size={11} /></span>
										{/if}
										<span class="min-w-0 flex-1 text-[13px] leading-5 text-neutral-600 dark:text-neutral-300">{line.text}</span>
										<span class="shrink-0 font-mono text-[10px] leading-5 text-neutral-400">{ago(a.createdAt)}</span>
									</svelte:element>
								</li>
							{/each}
						</ol>
					</section>
				{/if}

				<!-- Contributors -->
				{#if data.contributors.length}
					<section>
						<h2 class="pub-label">Contributors</h2>
						<div class="mt-3 flex flex-wrap items-center gap-2">
							{#each data.contributors.slice(0, 12) as m (m.username)}
								<a href={`/u/${m.username}`} title={`${m.displayName} · ${m.role}`} class="transition-transform hover:-translate-y-0.5">
									{#if m.avatarUrl}
										<img src={m.avatarUrl} alt={m.displayName} class="size-8 rounded-full ring-2 ring-white dark:ring-neutral-800" />
									{:else}
										<span class="grid size-8 place-items-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-600 ring-2 ring-white dark:bg-neutral-700 dark:text-neutral-200 dark:ring-neutral-800">{m.displayName.slice(0, 1).toUpperCase()}</span>
									{/if}
								</a>
							{/each}
						</div>
					</section>
				{/if}
			</div>
		</div>
	{/if}
</main>
