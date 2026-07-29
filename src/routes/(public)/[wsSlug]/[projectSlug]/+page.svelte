<script lang="ts">
	import {
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

<main class="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
	{#if isEmpty}
		<div class="mt-10 border-t border-[var(--rule)] pt-10">
			<EmptyState icon={Sparkles} title="The workshop just opened" body="Nothing on the wall yet — but the front door is open. Ideas and bug reports shape what gets built first.">
				<a
					href={`${base}/suggestions#post`}
					class="mono-focus inline-flex items-center gap-2 border border-[var(--accent)] px-5 py-2.5 text-[13px] tracking-tight text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--ground)]"
				>
					<Lightbulb size={15} /> Share the first idea
				</a>
			</EmptyState>
		</div>
	{:else}
		<!-- Pulse -->
		<section class="mt-8 grid gap-x-10 gap-y-6 lg:grid-cols-12">
			<div class="lg:col-span-7">
				<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
					<p class="flex items-center gap-2 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">
						<span class="relative flex size-1.5" aria-hidden="true">
							<span
								class="absolute inline-flex size-full rounded-full bg-[var(--accent)] opacity-60 {beat > 0 ? 'ot-breathe' : ''}"
							></span>
							<span class="relative inline-flex size-1.5 rounded-full bg-[var(--accent)]"></span>
						</span>
						01 // Pulse
					</p>
					{#if data.pulse.lastActivityAt}
						<span class="text-[11px] tabular-nums text-[var(--faint)]">last activity {ago(data.pulse.lastActivityAt)}</span>
					{/if}
				</div>
				<div class="mt-4">
					<Heartbeat weekly={data.pulse.weekly} {beat} />
				</div>
				<p class="mt-2 text-[11px] tabular-nums text-[var(--faint)]">
					{data.pulse.velocity.openedLast30d} opened · {data.pulse.velocity.closedLast30d} shipped in the last 30 days
				</p>
			</div>

			<div
				class="grid grid-cols-2 gap-x-6 gap-y-6 border-t border-[var(--rule)] pt-6 lg:col-span-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10"
			>
				<StatTile value={s.openTickets} label="Open" accent />
				<StatTile value={s.closedTickets} label="Shipped" />
				<StatTile value={s.openIdeas} label="Ideas waiting" />
				<StatTile value={s.contributors} label="Contributors" />
			</div>
		</section>

		<div class="mt-14 grid gap-x-10 gap-y-14 lg:grid-cols-12">
			<div class="space-y-14 lg:col-span-7">
				<!-- Now building -->
				{#if data.nowBuilding.length || data.milestones.length}
					<section class="border-t border-[var(--rule)] pt-8">
						<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
							<p class="flex items-center gap-2 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">
								<Hammer size={13} class="text-[var(--faint)]" /> 02 // Now building
							</p>
							<a
								href={`${base}/board`}
								class="mono-focus text-[12px] tracking-tight text-[var(--dim)] transition-colors hover:text-[var(--accent)]"
							>
								full board →
							</a>
						</div>

						{#if data.milestones.length}
							<div class="mt-5 space-y-3">
								{#each data.milestones as m (m.id)}
									<div class="flex items-center gap-3 text-[13px]">
										<Milestone size={13} class="shrink-0 text-[var(--faint)]" />
										<span class="min-w-0 truncate text-[var(--text)]">{m.title}</span>
										<div class="h-1 min-w-16 flex-1 bg-[var(--rule)]">
											<div class="h-full transition-all duration-500" style={`width:${msProgress(m)}%;background:var(--accent)`}></div>
										</div>
										<span class="shrink-0 text-[11px] tabular-nums text-[var(--faint)]"
											>{msProgress(m)}%{m.dueDate ? ` · due ${new Date(m.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}</span
										>
									</div>
								{/each}
							</div>
						{/if}

						<ul class="mt-5 border-t border-[var(--rule)]">
							{#each data.nowBuilding as t, i (t.id)}
								<li class="ot-rise border-b border-[var(--rule)]" style={`--rise-i:${i}`}>
									<a href={`${base}/t/${t.number}`} class="mono-focus group flex items-center gap-3 py-3 transition-colors">
										<span class="size-2 shrink-0 rounded-full" style={`background:${t.columnColor}`} title={t.columnName}></span>
										<span class="shrink-0 text-[12px] tabular-nums text-[var(--faint)]">#{t.number}</span>
										<span class="min-w-0 flex-1 truncate text-[14px] text-[var(--text)] group-hover:text-[var(--accent)]">{t.title}</span>
										{#if t.assignees.length}
											<span class="flex shrink-0 -space-x-1.5">
												{#each t.assignees.slice(0, 3) as a (a.userId ?? a.githubLogin)}
													{#if a.avatarUrl}
														<img
															src={a.avatarUrl}
															alt={a.displayName}
															title={a.displayName}
															class="size-5 rounded-full ring-2 ring-[var(--ground)]"
														/>
													{:else}
														<span
															class="grid size-5 place-items-center rounded-full border border-[var(--rule)] bg-[var(--raised)] text-[9px] font-semibold text-[var(--dim)] ring-2 ring-[var(--ground)]"
															title={a.displayName}>{a.displayName.slice(0, 1).toUpperCase()}</span
														>
													{/if}
												{/each}
											</span>
										{/if}
									</a>
								</li>
							{:else}
								<li class="border-b border-[var(--rule)] py-3 text-[13px] text-[var(--faint)]">— nothing on the bench right now.</li>
							{/each}
						</ul>
					</section>
				{/if}

				<!-- Recently shipped -->
				{#if data.shipped.length}
					<section class="border-t border-[var(--rule)] pt-8">
						<p class="flex items-center gap-2 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">
							<Rocket size={13} class="text-[var(--faint)]" /> 03 // Recently shipped
						</p>
						<ul class="mt-5 border-t border-[var(--rule)]">
							{#each data.shipped as t (t.id)}
								<li class="border-b border-[var(--rule)]">
									<a href={`${base}/t/${t.number}`} class="mono-focus group flex items-center gap-2.5 py-2.5 transition-colors">
										<CircleCheckBig size={14} class="shrink-0" style="color:var(--green)" />
										<span class="shrink-0 text-[12px] tabular-nums text-[var(--faint)]">#{t.number}</span>
										<span class="min-w-0 flex-1 truncate text-[13px] text-[var(--dim)] group-hover:text-[var(--text)]">{t.title}</span>
										{#each t.labels.slice(0, 2) as l (l.id)}
											<span class="hidden text-[10px] tracking-wide uppercase sm:inline" style={`color:${l.color}`}>{l.name}</span>
										{/each}
										<span class="shrink-0 text-[11px] tabular-nums text-[var(--faint)]">{ago(t.closedAt)}</span>
									</a>
								</li>
							{/each}
						</ul>
					</section>
				{/if}

				<!-- Latest release -->
				{#if data.latestRelease}
					{@const r = data.latestRelease}
					<section class="border-t border-[var(--rule)] pt-8">
						<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
							<p class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">04 // Latest release</p>
							<span class="ml-auto text-[11px] tabular-nums text-[var(--faint)]">{r.releasedAt ? ago(r.releasedAt) : ''}</span>
						</div>
						<p class="mono-display mt-3 text-2xl tracking-tight text-[var(--text)]">
							{r.version}{#if r.name}<span class="ml-2 text-base font-normal text-[var(--dim)]">{r.name}</span>{/if}
						</p>
						{#if r.notes}
							<div class="prose prose-sm prose-invert mt-2 line-clamp-3 max-w-none text-[var(--dim)]">{@html renderMarkdown(r.notes)}</div>
						{/if}
						<div class="mt-4 flex flex-wrap items-center gap-4">
							{#each r.links.slice(0, 2) as l (l.url)}
								<a
									href={l.url}
									target="_blank"
									rel="noopener"
									class="mono-focus inline-flex items-center gap-1.5 border border-[var(--accent)] px-3.5 py-1.5 text-[12px] tracking-tight text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--ground)]"
								>
									<PackageOpen size={13} /> {l.label}
								</a>
							{/each}
							<a
								href={`${base}/releases`}
								class="mono-focus ml-auto text-[12px] tracking-tight text-[var(--dim)] transition-colors hover:text-[var(--accent)]"
							>
								all releases{#if r.ticketCount}<span class="tabular-nums"> ({r.ticketCount} shipped)</span>{/if} →
							</a>
						</div>
					</section>
				{/if}
			</div>

			<div class="space-y-14 lg:col-span-5">
				<!-- Top ideas -->
				<section class="border-t border-[var(--rule)] pt-8">
					<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
						<p class="flex items-center gap-2 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">
							<Lightbulb size={13} class="text-[var(--faint)]" /> 05 // Top ideas
						</p>
						<a
							href={`${base}/suggestions`}
							class="mono-focus text-[12px] tracking-tight text-[var(--dim)] transition-colors hover:text-[var(--accent)]"
						>
							all feedback →
						</a>
					</div>
					<ul class="mt-5 border-t border-[var(--rule)]">
						{#each data.ideas as idea, i (idea.id)}
							<li class="ot-rise border-b border-[var(--rule)]" style={`--rise-i:${i}`}>
								<div class="flex items-center gap-3 py-3">
									<span class="vote-mono shrink-0">
										<UpvoteButton subjectType="suggestion" id={idea.id} count={idea.votes} voted={idea.voted} layout="row" />
									</span>
									<a href={`${base}/suggestions/${idea.id}`} class="mono-focus min-w-0 flex-1">
										<p class="truncate text-[14px] text-[var(--text)] transition-colors hover:text-[var(--accent)]">{idea.title}</p>
										{#if idea.comments > 0}
											<p class="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--faint)]"><MessageSquare size={11} /> {idea.comments}</p>
										{/if}
									</a>
								</div>
							</li>
						{:else}
							<li class="border-b border-[var(--rule)] py-3 text-[13px] text-[var(--faint)]">No open ideas — the floor is yours.</li>
						{/each}
					</ul>
					<a
						href={`${base}/suggestions#post`}
						class="mono-focus group mt-4 flex items-center justify-center gap-2 border border-[var(--rule)] py-2.5 text-[13px] tracking-tight text-[var(--dim)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
					>
						<Sparkles size={14} /> Share yours
					</a>
				</section>

				<!-- Activity -->
				{#if data.activity.length}
					<section class="border-t border-[var(--rule)] pt-8">
						<p class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">06 // Recent activity</p>
						<ol class="mt-5">
							{#each data.activity as a (a.id)}
								{@const line = actLine(a)}
								{@const Icon = line.icon}
								<li class="border-b border-[var(--rule)]">
									<svelte:element
										this={line.href ? 'a' : 'div'}
										href={line.href ?? undefined}
										class="mono-focus group flex items-start gap-2.5 py-2.5 {line.href ? 'transition-colors' : ''}"
									>
										{#if a.actorAvatar}
											<img src={a.actorAvatar} alt="" class="mt-0.5 size-5 shrink-0 rounded-full" />
										{:else}
											<span class="mt-0.5 grid size-5 shrink-0 place-items-center border border-[var(--rule)] text-[var(--faint)]"
												><Icon size={11} /></span
											>
										{/if}
										<span class="min-w-0 flex-1 text-[13px] leading-5 text-[var(--dim)] {line.href ? 'group-hover:text-[var(--text)]' : ''}"
											>{line.text}</span
										>
										<span class="shrink-0 text-[10px] leading-5 tabular-nums text-[var(--faint)]">{ago(a.createdAt)}</span>
									</svelte:element>
								</li>
							{/each}
						</ol>
					</section>
				{/if}

				<!-- Contributors -->
				{#if data.contributors.length}
					<section class="border-t border-[var(--rule)] pt-8">
						<p class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">07 // Contributors</p>
						<div class="mt-5 flex flex-wrap items-center gap-2.5">
							{#each data.contributors.slice(0, 12) as m (m.username)}
								<a href={`/u/${m.username}`} title={`${m.displayName} · ${m.role}`} class="mono-focus transition-opacity hover:opacity-70">
									{#if m.avatarUrl}
										<img src={m.avatarUrl} alt={m.displayName} class="size-8 rounded-full border border-[var(--rule)]" />
									{:else}
										<span
											class="grid size-8 place-items-center rounded-full border border-[var(--rule)] bg-[var(--raised)] text-[11px] font-semibold text-[var(--dim)]"
											>{m.displayName.slice(0, 1).toUpperCase()}</span
										>
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
