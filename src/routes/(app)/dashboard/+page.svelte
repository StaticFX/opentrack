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
		if (d - now < DAY) return { label: 'Today', cls: 'text-brand-600 dark:text-brand-400' };
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
		class="flex items-center gap-3 border-b border-neutral-100 px-3.5 py-2.5 last:border-0 hover:bg-neutral-50 dark:border-neutral-800/60 dark:hover:bg-neutral-800/40"
	>
		{#if t.priority !== 'none'}
			<span class="size-2 shrink-0 rounded-full" style={`background:${p.color}`} title={p.label}></span>
		{:else}
			<span class="size-2 shrink-0"></span>
		{/if}
		<span class="min-w-0 flex-1 truncate text-sm text-neutral-800 dark:text-neutral-100">{t.title}</span>
		{#if dm}<span class={`shrink-0 text-xs font-medium ${dm.cls}`}>{dm.label}</span>{/if}
		<span class="flex shrink-0 items-center gap-1 text-xs text-neutral-400">
			<span class="size-2 rounded-full" style={`background:${t.projColor ?? '#9ca3af'}`}></span>
			<span class="hidden sm:inline">{t.projName} ·</span> #{t.number}
		</span>
	</a>
{/snippet}

<div class="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
	<header class="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-xl font-semibold tracking-tight">{greeting}, {firstName}</h1>
			<p class="mt-0.5 text-sm text-neutral-500">Here's what's on your plate today.</p>
		</div>
		<Button variant="primary" href="/w/new"><Plus size={16} /> New workspace</Button>
	</header>

	{#if data.workspaces.length}
		<!-- Stats -->
		<div class="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
			{#each stats as s (s.label)}
				<svelte:element
					this={s.href ? 'a' : 'div'}
					href={s.href}
					class={`flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/40 ${s.href ? 'transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5' : ''}`}
				>
					<span class="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
						<s.icon size={17} />
					</span>
					<div class="min-w-0">
						<p class="text-xl font-semibold tabular-nums leading-none">{s.value}</p>
						<p class="mt-1 truncate text-xs text-neutral-500">{s.label}</p>
					</div>
				</svelte:element>
			{/each}
		</div>

		<div class="grid gap-8 lg:grid-cols-[1fr_20rem]">
			<div class="min-w-0 space-y-8">
				<!-- Contributor work: due soon -->
				<section>
					<div class="mb-3 flex items-center justify-between">
						<h2 class="flex items-center gap-2 text-sm font-semibold">
							<CalendarClock size={15} class="text-brand-500" /> Due soon
						</h2>
						<a href="/my" class="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">My Work <ArrowRight size={12} /></a>
					</div>
					<div class="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
						{#each data.dueSoon as t (t.id)}
							{@render workRow(t)}
						{:else}
							<p class="px-4 py-6 text-center text-sm text-neutral-400">Nothing due in the next week.</p>
						{/each}
					</div>
				</section>

				<!-- Contributor work: assigned -->
				<section>
					<div class="mb-3 flex items-center justify-between">
						<h2 class="flex items-center gap-2 text-sm font-semibold">
							<CircleDot size={15} class="text-neutral-500" /> Assigned to me
						</h2>
					</div>
					<div class="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
						{#each data.assigned as t (t.id)}
							{@render workRow(t)}
						{:else}
							<p class="px-4 py-6 text-center text-sm text-neutral-400">No open tickets assigned to you — nice and clear.</p>
						{/each}
					</div>
				</section>

				<!-- Workspaces -->
				<section>
					<h2 class="mb-3 text-sm font-semibold">Your workspaces</h2>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						{#each data.workspaces as ws (ws.id)}
							<a
								href={`/w/${ws.slug}`}
								class="group flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5"
							>
								{#if ws.avatarUrl}
									<img src={ws.avatarUrl} alt="" class="size-10 shrink-0 rounded-xl object-cover" />
								{:else}
									<div class="grid size-10 shrink-0 place-items-center rounded-xl text-lg font-bold text-white" style={`background:${ws.color || 'var(--color-brand-600)'}`}>
										{#if ws.icon}{ws.icon}{:else}{ws.name.slice(0, 1).toUpperCase()}{/if}
									</div>
								{/if}
								<div class="min-w-0 flex-1">
									<p class="truncate font-medium">{ws.name}</p>
									<p class="truncate text-xs text-neutral-500">
										{data.projectCounts[ws.id] ?? 0} project{(data.projectCounts[ws.id] ?? 0) === 1 ? '' : 's'}
									</p>
								</div>
								<ArrowRight size={16} class="text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
							</a>
						{/each}
					</div>
				</section>
			</div>

			<!-- Recent activity -->
			<aside>
				<h2 class="mb-3 text-sm font-semibold">Recent activity</h2>
				{#if data.activity.length}
					<ul class="space-y-0.5">
						{#each data.activity as a (a.id)}
							{@const Icon = actIcon(a.type)}
							<li class="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
								<div class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
									<Icon size={13} />
								</div>
								<p class="min-w-0 flex-1 text-sm">
									<span class="font-medium">{a.actorName ?? 'Someone'}</span>
									<span class="text-neutral-500">{verb(a)}</span>
									<span>{subject(a)}</span>
									{#if a.projectName}<span class="text-neutral-400"> · {a.projectName}</span>{/if}
									<span class="ml-1 text-xs text-neutral-400">{ago(a.createdAt)}</span>
								</p>
							</li>
						{/each}
					</ul>
				{:else}
					<div class="rounded-2xl border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-400 dark:border-neutral-700">
						No activity yet.
					</div>
				{/if}
			</aside>
		</div>
	{:else}
		<div class="rounded-2xl border border-dashed border-neutral-300 py-16 text-center dark:border-neutral-700">
			<p class="text-sm text-neutral-500">You don't have any workspaces yet.</p>
			<div class="mt-4">
				<Button variant="primary" href="/w/new"><Plus size={16} /> Create your first workspace</Button>
			</div>
		</div>
	{/if}
</div>
