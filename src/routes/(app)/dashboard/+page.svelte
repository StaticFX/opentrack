<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, ArrowRight, Folder, SquareKanban, CircleCheck, Boxes } from '@lucide/svelte';
	import EmptyStateApp from '$lib/components/ui/EmptyStateApp.svelte';
	import TimeAgo from '$lib/components/ui/TimeAgo.svelte';
	import ViewHeader from '$lib/components/app/ViewHeader.svelte';
	import ActivityFeed from '$lib/components/app/ActivityFeed.svelte';
	import { PRIORITY_META } from '$lib/priority';
	import { dueMeta } from '$lib/time';
	import { cn } from '$lib/utils/cn';
	import type { Priority } from '$lib/constants';
	import type { MyTicket } from '$lib/server/services/mywork';

	let { data } = $props();

	const firstName = $derived((data.user.displayName ?? '').split(/\s+/)[0] || 'there');
	const greeting = (() => {
		const h = new Date().getHours();
		if (h < 12) return 'Good morning';
		if (h < 18) return 'Good afternoon';
		return 'Good evening';
	})();

	// Continue row: last-visited projects/boards, recorded by the (app) layout
	// on every navigation. Read client-side only — nothing to render on the
	// server for a per-browser list.
	type Recent = { href: string; label: string; type: 'project' | 'board'; ts: number };
	let recents = $state<Recent[]>([]);
	onMount(() => {
		try {
			const raw = JSON.parse(localStorage.getItem('ot-recents') ?? '[]');
			recents = Array.isArray(raw) ? raw.slice(0, 3) : [];
		} catch {
			recents = [];
		}
	});

	/** The recent's own workspace color (matched by slug) as its tile tint —
	 * recents don't carry a project color, so this is the closest known accent. */
	function recentColor(href: string): string | undefined {
		const m = href.match(/^\/w\/([^/]+)\//);
		return m ? (data.workspaces.find((w) => w.slug === m[1])?.color ?? undefined) : undefined;
	}
</script>

<svelte:head><title>Home · OpenTrack</title></svelte:head>

{#snippet workRow(t: MyTicket)}
	{@const p = PRIORITY_META[t.priority as Priority]}
	{@const dm = dueMeta(t.dueDate)}
	<li class="border-b border-[var(--rule)]">
		<a href={t.url} class="mono-focus group flex h-9 items-center gap-3 text-[13px] transition-colors">
			{#if t.priority !== 'none'}
				<span class="size-2 shrink-0 rounded-full" style={`background:${p.color}`} title={p.label} aria-hidden="true"></span>
			{:else}
				<span class="size-2 shrink-0" aria-hidden="true"></span>
			{/if}
			<span class="min-w-0 flex-1 truncate text-[var(--text)] group-hover:text-[var(--accent)]">{t.title}</span>
			{#if dm}
				<span
					class={cn(
						'data-mono shrink-0',
						dm.overdue ? 'text-[#f85149]' : dm.soon ? 'text-[var(--amber)]' : 'text-[var(--faint)]'
					)}>{dm.label}</span
				>
			{/if}
			<span class="flex shrink-0 items-center gap-1.5 text-[var(--faint)]">
				<span class="size-1.5 rounded-full" style={`background:${t.projColor ?? 'var(--faint)'}`} aria-hidden="true"></span>
				<span class="data-mono hidden sm:inline">{t.projName}</span> <span class="data-mono">#{t.number}</span>
			</span>
		</a>
	</li>
{/snippet}

<ViewHeader crumbs={[{ label: 'Home' }]} overflow={[{ label: 'New workspace', icon: Plus, href: '/w/new' }]} />

<div class="view-4xl">
	{#if data.workspaces.length}
		<div class="pb-6">
			<h1 class="mono-display text-2xl text-[var(--text)]">{greeting}, {firstName}</h1>
			<p class="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-[var(--dim)]">
				<a href="/my" class="mono-focus">
					<span class="data-mono text-[var(--text)]">{data.stats.assignedOpen}</span> assigned →
				</a>
				<span aria-hidden="true">·</span>
				<a href="/my" class="mono-focus">
					<span class="data-mono text-[var(--text)]">{data.stats.dueSoonCount}</span> due →
				</a>
			</p>
		</div>

		{#if recents.length}
			<section class="border-t border-[var(--rule)] pt-6 pb-6">
				<p class="mb-3 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Continue</p>
				<ul class="border-t border-[var(--rule)]">
					{#each recents as r (r.href)}
						<li class="border-b border-[var(--rule)]">
							<a href={r.href} class="mono-focus group flex items-center gap-3 py-2.5 transition-colors">
								<span
									class="grid size-6 shrink-0 place-items-center rounded-[3px] text-[var(--ground)]"
									style={`background:${recentColor(r.href) ?? 'var(--accent)'}`}
								>
									{#if r.type === 'board'}<SquareKanban size={12} aria-hidden="true" />{:else}<Folder size={12} aria-hidden="true" />{/if}
								</span>
								<span class="min-w-0 flex-1 truncate text-[13px] text-[var(--text)] group-hover:text-[var(--accent)]">{r.label}</span>
								<span class="data-mono shrink-0 text-[var(--faint)]">{r.type === 'board' ? 'Board' : 'Project'}</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<div class="grid gap-x-10 gap-y-10 border-t border-[var(--rule)] pt-6 lg:grid-cols-[1fr_20rem]">
			<div class="min-w-0 space-y-10">
				<section>
					<div class="mb-3 flex items-baseline justify-between">
						<p class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Needs you</p>
						<a href="/my" class="mono-focus flex items-center gap-1 text-[12px] text-[var(--faint)] hover:text-[var(--accent)]"
							>My Work <ArrowRight size={12} aria-hidden="true" /></a
						>
					</div>
					{#if data.topWork.length}
						<ul class="border-t border-[var(--rule)]">
							{#each data.topWork as t (t.id)}
								{@render workRow(t)}
							{/each}
						</ul>
					{:else}
						<EmptyStateApp icon={CircleCheck} title="Nothing needs you right now." compact />
					{/if}
				</section>

				<section class="border-t border-[var(--rule)] pt-8">
					<p class="mb-3 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Workspaces</p>
					<ul class="border-t border-[var(--rule)]">
						{#each data.workspaces as ws (ws.id)}
							<li class="border-b border-[var(--rule)]">
								<a href={`/w/${ws.slug}`} class="mono-focus group flex items-center gap-3 py-2.5 transition-colors">
									{#if ws.avatarUrl}
										<img src={ws.avatarUrl} alt="" class="size-6 shrink-0 rounded-[3px] object-cover" />
									{:else}
										<span
											class="grid size-6 shrink-0 place-items-center rounded-[3px] text-[11px] font-bold text-[var(--ground)]"
											style={`background:${ws.color || 'var(--accent)'}`}
										>
											{#if ws.icon}{ws.icon}{:else}{ws.name.slice(0, 1).toUpperCase()}{/if}
										</span>
									{/if}
									<span class="min-w-0 flex-1 truncate text-[13px] text-[var(--text)] group-hover:text-[var(--accent)]">{ws.name}</span>
									<span class="data-mono hidden shrink-0 text-[var(--faint)] sm:inline">
										{data.projectCounts[ws.id] ?? 0} project{(data.projectCounts[ws.id] ?? 0) === 1 ? '' : 's'}
										{#if data.lastActivityAt[ws.id]}
											· <TimeAgo date={data.lastActivityAt[ws.id]} class="inline" />
										{/if}
									</span>
									<ArrowRight
										size={14}
										class="shrink-0 text-[var(--faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
										aria-hidden="true"
									/>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			</div>

			<aside>
				<p class="mb-3 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Activity</p>
				<ActivityFeed items={data.activity} limit={12} />
			</aside>
		</div>
	{:else}
		<EmptyStateApp
			icon={Boxes}
			title="No workspaces yet."
			body="Create one to start tracking work."
			action={{ label: 'Create your first workspace', href: '/w/new' }}
		/>
	{/if}
</div>
