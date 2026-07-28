<script lang="ts">
	import { page } from '$app/state';
	import {
		Lightbulb,
		ExternalLink,
		Tag,
		Activity as ActivityIcon,
		LayoutGrid,
		Plus,
		ArrowRight,
		CircleCheck,
		MessageSquare,
		CircleDot,
		ListChecks,
		Users,
		Link2
	} from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import ProjectPageHeader from '$lib/components/app/ProjectPageHeader.svelte';
	import SpotlightCard from '$lib/components/vendor/SpotlightCard.svelte';

	let { data } = $props();

	const wsSlug = $derived(page.params.wsSlug);
	const projectSlug = $derived(page.params.projectSlug);
	const base = $derived(`/w/${wsSlug}/p/${projectSlug}`);
	const firstBoard = $derived(data.boards[0]);

	const stats = $derived([
		{ label: 'Open tickets', value: data.stats.openTickets, icon: CircleDot, accent: true },
		{ label: 'Total tickets', value: data.stats.totalTickets, icon: ListChecks, accent: false },
		{ label: 'Boards', value: data.stats.boards, icon: LayoutGrid, accent: false },
		{ label: 'Feedback', value: data.stats.suggestions, icon: Lightbulb, accent: false },
		{ label: 'Releases', value: data.stats.releases, icon: Tag, accent: false },
		{ label: 'Collaborators', value: data.stats.members, icon: Users, accent: false }
	]);

	// ── Activity formatting (shared shape with the Activity page) ──
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

	function initials(name: string) {
		return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
	}
</script>

<svelte:head><title>{data.project.name} · OpenTrack</title></svelte:head>

<div class="flex h-full flex-col">
	<!-- Header -->
	<ProjectPageHeader section="Overview" />

	<!-- Body -->
	<div class="min-h-0 flex-1 overflow-y-auto">
		<div class="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
			<!-- Identity -->
			<div class="ot-rise mb-8 flex items-start gap-4" style="--rise-i:0">
				<div
					class="grid size-12 shrink-0 place-items-center rounded-xl text-xl font-bold text-white shadow-sm"
					style="background:linear-gradient(140deg, color-mix(in oklab, var(--accent) 86%, white), var(--accent))"
				>
					{#if data.project.icon}{data.project.icon}{:else}{data.project.name.slice(0, 1).toUpperCase()}{/if}
				</div>
				<div class="min-w-0 flex-1">
					<h2 class="font-display text-xl font-bold tracking-tight">{data.project.name}</h2>
					{#if data.project.description}
						<p class="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{data.project.description}</p>
					{:else}
						<p class="mt-0.5 text-sm text-neutral-400 italic">
							No description yet.{#if data.canManageProject}
								<a href={`${base}/settings`} class="ml-1 font-medium text-[var(--accent-fg)] not-italic hover:underline">Add one →</a>{/if}
						</p>
					{/if}
					<div class="mt-2.5 flex flex-wrap items-center gap-2">
						{#if firstBoard}
							<Button variant="accent" size="sm" href={`${base}/b/${firstBoard.id}`}><LayoutGrid size={14} /> Open board</Button>
						{/if}
						{#if data.project.githubRepo}
							<a href={`https://github.com/${data.project.githubRepo}`} target="_blank" rel="noreferrer" class="inline-flex items-center gap-1.5 rounded-full border border-black/8 px-2.5 py-1 font-mono text-[11px] text-neutral-500 transition-colors hover:border-[var(--accent-border)] hover:text-[var(--accent-fg)] dark:border-white/10 dark:text-neutral-400">
								<Link2 size={13} /> {data.project.githubRepo}
							</a>
						{/if}
					</div>
				</div>
			</div>

			<!-- Stats -->
			<div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
				{#each stats as s, i (s.label)}
					<SpotlightCard class="pub-card ot-rise px-3.5 py-3" style={`--rise-i:${i + 1}`}>
						<s.icon size={15} class={s.accent ? 'text-[var(--accent-fg)]' : 'text-neutral-400'} />
						<p class={`mt-2 font-mono text-2xl font-bold tabular-nums ${s.accent ? 'text-[var(--accent-fg)]' : ''}`}>{s.value}</p>
						<p class="pub-label mt-0.5">{s.label}</p>
					</SpotlightCard>
				{/each}
			</div>

			<div class="grid gap-8 lg:grid-cols-[1fr_18rem]">
				<!-- Boards + activity -->
				<div class="ot-rise min-w-0 space-y-8" style="--rise-i:7">
					<!-- Boards: only surfaced with 2+ (the sidebar + Open board cover a single board). -->
					{#if data.boards.length > 1}
						<section>
							<div class="mb-3 flex items-baseline justify-between">
								<h3 class="font-display text-[15px] font-semibold tracking-tight">Boards</h3>
							</div>
							<ul class="pub-card divide-y divide-black/5 overflow-hidden dark:divide-white/8">
								{#each data.boards as b (b.id)}
									<li>
										<a href={`${base}/b/${b.id}`} class="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
											<LayoutGrid size={15} class="text-neutral-400" />
											<span class="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-[var(--accent-fg)]">{b.name}</span>
											<ArrowRight size={14} class="text-neutral-300 transition-transform group-hover:translate-x-0.5 dark:text-neutral-600" />
										</a>
									</li>
								{/each}
							</ul>
						</section>
					{/if}

					<!-- Recent activity -->
					<section>
						<div class="mb-3 flex items-baseline justify-between">
							<h3 class="font-display text-[15px] font-semibold tracking-tight">Recent activity</h3>
							{#if data.activity.length}
								<a href={`${base}/activity`} class="flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-[var(--accent-fg)]">view all <ArrowRight size={12} /></a>
							{/if}
						</div>
						{#if data.activity.length}
							<ul class="space-y-0.5">
								{#each data.activity as a (a.id)}
									{@const Icon = actIcon(a.type)}
									<li class="flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
										<div class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-black/5 text-neutral-400 dark:bg-white/10">
											<Icon size={11} />
										</div>
										<p class="min-w-0 flex-1 text-[13px] leading-5">
											<span class="font-medium">{a.actorName ?? 'Someone'}</span>
											<span class="text-neutral-500 dark:text-neutral-400">{verb(a)}</span>
											<span class="text-neutral-600 dark:text-neutral-300">{subject(a)}</span>
										</p>
										<span class="shrink-0 font-mono text-[10px] leading-5 text-neutral-400">{ago(a.createdAt)}</span>
									</li>
								{/each}
							</ul>
						{:else}
							<div class="rounded-2xl bg-black/[0.03] py-10 text-center dark:bg-white/[0.04]">
								<p class="text-sm text-neutral-400">No activity yet.</p>
								{#if firstBoard}
									<a href={`${base}/b/${firstBoard.id}`} class="mt-1 inline-block text-xs font-medium text-[var(--accent-fg)] hover:underline">Create your first ticket →</a>
								{/if}
							</div>
						{/if}
					</section>
				</div>

				<!-- Sidebar: members + quick links -->
				<aside class="ot-rise space-y-6" style="--rise-i:8">
					<section>
						<h3 class="pub-label mb-3">Collaborators</h3>
						{#if data.members.length}
							<ul class="space-y-2">
								{#each data.members as m (m.userId)}
									<li class="flex items-center gap-2.5">
										{#if m.avatarUrl}
											<img src={m.avatarUrl} alt="" class="size-7 rounded-full" />
										{:else}
											<div class="grid size-7 place-items-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-200">{initials(m.displayName)}</div>
										{/if}
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm">{m.displayName}</p>
										</div>
										<span class="text-[11px] capitalize text-neutral-400 dark:text-neutral-500">{m.role}</span>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="text-sm text-neutral-400">No collaborators yet.</p>
						{/if}
						{#if data.canManageProject}
							<a href={`${base}/settings`} class="mt-3 inline-flex items-center gap-1 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700 dark:hover:text-neutral-300"><Plus size={13} /> Manage collaborators</a>
						{/if}
					</section>

					<section>
						<h3 class="pub-label mb-3">Public page</h3>
						<div class="flex flex-col gap-1 text-sm">
							<a href={`/${wsSlug}/${projectSlug}`} target="_blank" rel="noreferrer" class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-neutral-600 transition-colors hover:bg-black/[0.03] dark:text-neutral-300 dark:hover:bg-white/[0.05]"><ExternalLink size={14} class="text-neutral-400" /> View public page</a>
						</div>
					</section>
				</aside>
			</div>
		</div>
	</div>
</div>
