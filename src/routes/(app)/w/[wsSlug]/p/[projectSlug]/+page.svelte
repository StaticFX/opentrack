<script lang="ts">
	import { page } from '$app/state';
	import {
		Settings,
		Lightbulb,
		ExternalLink,
		Tag,
		Milestone,
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

	let { data } = $props();

	const wsSlug = $derived(page.params.wsSlug);
	const projectSlug = $derived(page.params.projectSlug);
	const base = $derived(`/w/${wsSlug}/p/${projectSlug}`);
	const firstBoard = $derived(data.boards[0]);

	const stats = $derived([
		{ label: 'Open tickets', value: data.stats.openTickets, icon: CircleDot },
		{ label: 'Total tickets', value: data.stats.totalTickets, icon: ListChecks },
		{ label: 'Boards', value: data.stats.boards, icon: LayoutGrid },
		{ label: 'Suggestions', value: data.stats.suggestions, icon: Lightbulb },
		{ label: 'Releases', value: data.stats.releases, icon: Tag },
		{ label: 'Collaborators', value: data.stats.members, icon: Users }
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
			<div class="mb-6 flex items-start gap-4">
				<div class="grid size-12 shrink-0 place-items-center rounded-xl text-xl font-bold text-white" style={`background:${data.project.color ?? 'var(--color-brand-600)'}`}>
					{#if data.project.icon}{data.project.icon}{:else}{data.project.name.slice(0, 1).toUpperCase()}{/if}
				</div>
				<div class="min-w-0 flex-1">
					<h2 class="text-lg font-semibold tracking-tight">{data.project.name}</h2>
					{#if data.project.description}
						<p class="mt-0.5 text-sm text-neutral-500">{data.project.description}</p>
					{:else}
						<p class="mt-0.5 text-sm text-neutral-400 italic">
							No description yet.{#if data.canManageProject}
								<a href={`${base}/settings`} class="ml-1 font-medium text-brand-600 not-italic hover:underline">Add one →</a>{/if}
						</p>
					{/if}
					<div class="mt-2 flex flex-wrap items-center gap-2">
						{#if firstBoard}
							<Button variant="primary" size="sm" href={`${base}/b/${firstBoard.id}`}><LayoutGrid size={14} /> Open board</Button>
						{/if}
						{#if data.project.githubRepo}
							<a href={`https://github.com/${data.project.githubRepo}`} target="_blank" rel="noreferrer" class="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800">
								<Link2 size={13} /> {data.project.githubRepo}
							</a>
						{/if}
					</div>
				</div>
			</div>

			<!-- Stats -->
			<div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
				{#each stats as s (s.label)}
					<div class="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
						<s.icon size={16} class="text-neutral-400" />
						<p class="mt-2 text-xl font-semibold tabular-nums">{s.value}</p>
						<p class="text-xs text-neutral-500">{s.label}</p>
					</div>
				{/each}
			</div>

			<div class="grid gap-8 lg:grid-cols-[1fr_18rem]">
				<!-- Boards + activity -->
				<div class="min-w-0 space-y-8">
					<!-- Boards: only surfaced with 2+ (the sidebar + Open board cover a single board). -->
					{#if data.boards.length > 1}
						<section>
							<div class="mb-2 flex items-center justify-between">
								<h3 class="text-sm font-semibold">Boards</h3>
							</div>
							<ul class="divide-y divide-neutral-100 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
								{#each data.boards as b (b.id)}
									<li>
										<a href={`${base}/b/${b.id}`} class="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
											<LayoutGrid size={15} class="text-neutral-400" />
											<span class="flex-1 text-sm font-medium">{b.name}</span>
											<ArrowRight size={14} class="text-neutral-300 dark:text-neutral-600" />
										</a>
									</li>
								{/each}
							</ul>
						</section>
					{/if}

					<!-- Recent activity -->
					<section>
						<div class="mb-2 flex items-center justify-between">
							<h3 class="text-sm font-semibold">Recent activity</h3>
							{#if data.activity.length}
								<a href={`${base}/activity`} class="text-xs text-neutral-400 hover:text-neutral-600">View all</a>
							{/if}
						</div>
						{#if data.activity.length}
							<ul class="space-y-0.5">
								{#each data.activity as a (a.id)}
									{@const Icon = actIcon(a.type)}
									<li class="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
										<div class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
											<Icon size={13} />
										</div>
										<p class="flex-1 text-sm">
											<span class="font-medium">{a.actorName ?? 'Someone'}</span>
											<span class="text-neutral-500">{verb(a)}</span>
											<span>{subject(a)}</span>
											<span class="ml-1 text-xs text-neutral-400">· {ago(a.createdAt)}</span>
										</p>
									</li>
								{/each}
							</ul>
						{:else}
							<div class="rounded-xl border border-dashed border-neutral-300 py-10 text-center dark:border-neutral-700">
								<p class="text-sm text-neutral-400">No activity yet.</p>
								{#if firstBoard}
									<a href={`${base}/b/${firstBoard.id}`} class="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline">Create your first ticket →</a>
								{/if}
							</div>
						{/if}
					</section>
				</div>

				<!-- Sidebar: members + quick links -->
				<aside class="space-y-6">
					<section>
						<h3 class="mb-2 text-sm font-semibold">Collaborators</h3>
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
										<span class="text-xs capitalize text-neutral-400">{m.role}</span>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="text-sm text-neutral-400">No collaborators yet.</p>
						{/if}
						{#if data.canManageProject}
							<a href={`${base}/settings`} class="mt-3 inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700"><Plus size={13} /> Manage collaborators</a>
						{/if}
					</section>

					<section>
						<h3 class="mb-2 text-sm font-semibold">Public page</h3>
						<div class="flex flex-col gap-1 text-sm">
							<a href={`/${wsSlug}/${projectSlug}`} target="_blank" rel="noreferrer" class="flex items-center gap-2 rounded-md px-2 py-1.5 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"><ExternalLink size={14} class="text-neutral-400" /> View public page</a>
						</div>
					</section>
				</aside>
			</div>
		</div>
	</div>
</div>
