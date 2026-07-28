<script lang="ts">
	import {
		Plus,
		ArrowRight,
		Boxes,
		FolderKanban,
		CircleDot,
		CalendarClock,
		Lightbulb,
		Tag,
		CircleCheck,
		MessageSquare,
		Activity as ActivityIcon
	} from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import BlurText from '$lib/components/vendor/BlurText.svelte';
	import SpotlightCard from '$lib/components/vendor/SpotlightCard.svelte';
	import { PRIORITY_META } from '$lib/priority';
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

	const stats = $derived([
		{ label: 'Workspaces', value: data.stats.workspaces, icon: Boxes },
		{ label: 'Projects', value: data.stats.projects, icon: FolderKanban },
		{ label: 'Assigned to me', value: data.stats.assignedOpen, icon: CircleDot, href: '/my' },
		{ label: 'Due this week', value: data.stats.dueSoonCount, icon: CalendarClock, href: '/my' }
	]);

	const DAY = 86_400_000;
	function dueMeta(due: Date | string | null) {
		if (!due) return null;
		const d = new Date(due).getTime();
		const now = Date.now();
		if (d < now) return { label: 'Overdue', cls: 'text-red-600 dark:text-red-400' };
		if (d - now < DAY) return { label: 'Today', cls: 'text-[var(--accent-fg)]' };
		const days = Math.round((d - now) / DAY);
		return { label: `${days}d`, cls: 'text-neutral-500' };
	}

	// ── Activity formatting (shared shape with the project/workspace feeds) ──
	function subject(a: any) {
		if (a.subjectType === 'ticket' && a.ticketNumber != null) return `#${a.ticketNumber} ${a.ticketTitle ?? ''}`;
		if (a.subjectType === 'suggestion') return a.suggestionTitle ?? 'a suggestion';
		if (a.subjectType === 'release') return a.releaseVersion ?? 'a release';
		return '';
	}
	function verb(a: any): string {
		switch (a.type) {
			case 'ticket.created': return 'created';
			case 'ticket.moved': return `moved to ${a.data?.column ?? ''} —`;
			case 'ticket.closed': return 'closed';
			case 'ticket.commented': return 'commented on';
			case 'suggestion.created': return 'suggested';
			case 'suggestion.status': return `marked as ${a.data?.status ?? ''} —`;
			case 'release.published': return 'published';
			default: return a.type;
		}
	}
	function actIcon(t: string) {
		if (t === 'ticket.created') return Plus;
		if (t === 'ticket.moved') return ArrowRight;
		if (t === 'ticket.closed') return CircleCheck;
		if (t === 'ticket.commented') return MessageSquare;
		if (t.startsWith('suggestion')) return Lightbulb;
		if (t.startsWith('release')) return Tag;
		return ActivityIcon;
	}
	function ago(d: string | Date): string {
		const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
		if (s < 60) return 'just now';
		if (s < 3600) return `${Math.floor(s / 60)}m ago`;
		if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
		return `${Math.floor(s / 86400)}d ago`;
	}
</script>

<svelte:head><title>Dashboard · OpenTrack</title></svelte:head>

{#snippet workRow(t: MyTicket)}
	{@const p = PRIORITY_META[t.priority as Priority]}
	{@const dm = dueMeta(t.dueDate)}
	<a
		href={t.url}
		class="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
	>
		{#if t.priority !== 'none'}
			<span class="size-2 shrink-0 rounded-full" style={`background:${p.color}`} title={p.label}></span>
		{:else}
			<span class="size-2 shrink-0"></span>
		{/if}
		<span class="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">{t.title}</span>
		{#if dm}<span class={`shrink-0 font-mono text-[11px] font-medium ${dm.cls}`}>{dm.label}</span>{/if}
		<span class="flex shrink-0 items-center gap-1.5 text-xs text-neutral-400">
			<span class="size-2 rounded-full" style={`background:${t.projColor ?? '#9ca3af'}`}></span>
			<span class="hidden sm:inline">{t.projName}</span> <span class="font-mono">#{t.number}</span>
		</span>
	</a>
{/snippet}

<div class="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
	<header class="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="type-poster text-2xl sm:text-3xl">
				<BlurText text={`${greeting}, ${firstName}`} />
			</h1>
			<p class="mt-1 text-sm text-neutral-500">Here's what's on your plate today.</p>
		</div>
		<Button variant="accent" href="/w/new"><Plus size={16} /> New workspace</Button>
	</header>

	{#if data.workspaces.length}
		<!-- Stats -->
		<div class="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
			{#each stats as s, i (s.label)}
				<SpotlightCard
					class={`pub-card ot-rise ${s.href ? 'transition duration-150 hover:-translate-y-0.5' : ''}`}
					style={`--rise-i:${i}`}
				>
					<svelte:element this={s.href ? 'a' : 'div'} href={s.href} class="flex items-center gap-3 rounded-2xl p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent-solid)]">
						<span class="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-fg)]">
							<s.icon size={17} />
						</span>
						<div class="min-w-0">
							<p class="font-mono text-xl font-semibold tabular-nums leading-none">{s.value}</p>
							<p class="pub-label mt-1 truncate">{s.label}</p>
						</div>
					</svelte:element>
				</SpotlightCard>
			{/each}
		</div>

		<div class="grid gap-8 lg:grid-cols-[1fr_20rem]">
			<div class="min-w-0 space-y-8">
				<!-- Contributor work: due soon -->
				<section>
					<div class="mb-3 flex items-baseline justify-between">
						<h2 class="type-poster flex items-center gap-2 text-lg">
							<CalendarClock size={16} class="text-[var(--accent-fg)]" /> Due soon
						</h2>
						<a href="/my" class="flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-[var(--accent-fg)]">My Work <ArrowRight size={12} /></a>
					</div>
					<div class="space-y-0.5">
						{#each data.dueSoon as t (t.id)}
							{@render workRow(t)}
						{:else}
							<p class="rounded-2xl bg-black/[0.03] px-4 py-6 text-center text-sm text-neutral-400 dark:bg-white/[0.04]">Nothing due in the next week.</p>
						{/each}
					</div>
				</section>

				<!-- Contributor work: assigned -->
				<section>
					<div class="mb-3 flex items-baseline justify-between">
						<h2 class="type-poster flex items-center gap-2 text-lg">
							<CircleDot size={16} class="text-neutral-400" /> Assigned to me
						</h2>
					</div>
					<div class="space-y-0.5">
						{#each data.assigned as t (t.id)}
							{@render workRow(t)}
						{:else}
							<p class="rounded-2xl bg-black/[0.03] px-4 py-6 text-center text-sm text-neutral-400 dark:bg-white/[0.04]">No open tickets assigned to you — nice and clear.</p>
						{/each}
					</div>
				</section>

				<!-- Workspaces -->
				<section>
					<h2 class="type-poster mb-3 text-lg">Your workspaces</h2>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						{#each data.workspaces as ws, i (ws.id)}
							<a
								href={`/w/${ws.slug}`}
								class="pub-card ot-rise group flex items-center gap-3 p-4 transition duration-150 hover:-translate-y-0.5"
								style={`--rise-i:${i}`}
							>
								{#if ws.avatarUrl}
									<img src={ws.avatarUrl} alt="" class="size-10 shrink-0 rounded-xl object-cover shadow-sm" />
								{:else}
									<div
										class="grid size-10 shrink-0 place-items-center rounded-xl text-lg font-bold text-white shadow-sm"
										style={`background:linear-gradient(140deg, color-mix(in oklab, ${ws.color || 'var(--color-brand-600)'} 86%, white), ${ws.color || 'var(--color-brand-600)'})`}
									>
										{#if ws.icon}{ws.icon}{:else}{ws.name.slice(0, 1).toUpperCase()}{/if}
									</div>
								{/if}
								<div class="min-w-0 flex-1">
									<p class="truncate font-display font-semibold tracking-tight group-hover:text-[var(--accent-fg)]">{ws.name}</p>
									<p class="mt-0.5 truncate font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
										{data.projectCounts[ws.id] ?? 0} project{(data.projectCounts[ws.id] ?? 0) === 1 ? '' : 's'}
									</p>
								</div>
								<ArrowRight size={16} class="text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent-fg)] dark:text-neutral-600" />
							</a>
						{/each}
					</div>
				</section>
			</div>

			<!-- Recent activity -->
			<aside>
				<h2 class="pub-label mb-3">Recent activity</h2>
				{#if data.activity.length}
					<ul class="space-y-0.5">
						{#each data.activity as a (a.id)}
							{@const Icon = actIcon(a.type)}
							<li class="flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
								<span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-black/5 text-neutral-400 dark:bg-white/10">
									<Icon size={11} />
								</span>
								<p class="min-w-0 flex-1 text-[13px] leading-5 text-neutral-600 dark:text-neutral-300">
									<span class="font-medium text-neutral-800 dark:text-neutral-100">{a.actorName ?? 'Someone'}</span>
									<span class="text-neutral-500">{verb(a)}</span>
									<span>{subject(a)}</span>
									{#if a.projectName}<span class="text-neutral-400"> · {a.projectName}</span>{/if}
								</p>
								<span class="shrink-0 font-mono text-[10px] leading-5 text-neutral-400">{ago(a.createdAt)}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<div class="rounded-2xl bg-black/[0.03] py-10 text-center text-sm text-neutral-400 dark:bg-white/[0.04]">
						No activity yet.
					</div>
				{/if}
			</aside>
		</div>
	{:else}
		<div class="rounded-2xl bg-black/[0.03] py-16 text-center dark:bg-white/[0.04]">
			<p class="text-sm text-neutral-500">You don't have any workspaces yet.</p>
			<div class="mt-4">
				<Button variant="accent" href="/w/new"><Plus size={16} /> Create your first workspace</Button>
			</div>
		</div>
	{/if}
</div>
