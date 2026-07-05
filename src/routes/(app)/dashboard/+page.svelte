<script lang="ts">
	import {
		Plus,
		ArrowRight,
		Boxes,
		FolderKanban,
		CircleDot,
		Lightbulb,
		Tag,
		CircleCheck,
		MessageSquare,
		Activity as ActivityIcon
	} from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';

	let { data } = $props();

	const stats = $derived([
		{ label: 'Workspaces', value: data.stats.workspaces, icon: Boxes },
		{ label: 'Projects', value: data.stats.projects, icon: FolderKanban },
		{ label: 'Assigned to me', value: data.stats.assignedOpen, icon: CircleDot }
	]);

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

<div class="mx-auto max-w-5xl px-8 py-8">
	<header class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-xl font-semibold tracking-tight">Dashboard</h1>
			<p class="mt-0.5 text-sm text-neutral-500">Welcome back, {data.user.displayName}</p>
		</div>
		<Button variant="primary" href="/w/new"><Plus size={16} /> New workspace</Button>
	</header>

	{#if data.workspaces.length}
		<!-- Stats -->
		<div class="mb-8 grid grid-cols-3 gap-3">
			{#each stats as s (s.label)}
				<div class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
					<s.icon size={16} class="text-neutral-400" />
					<p class="mt-2 text-xl font-semibold tabular-nums">{s.value}</p>
					<p class="text-xs text-neutral-500">{s.label}</p>
				</div>
			{/each}
		</div>

		<div class="grid gap-8 lg:grid-cols-[1fr_20rem]">
			<!-- Workspaces -->
			<section class="min-w-0">
				<h2 class="mb-3 text-sm font-semibold">Your workspaces</h2>
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					{#each data.workspaces as ws (ws.id)}
						<a
							href={`/w/${ws.slug}`}
							class="group flex items-center gap-3 rounded-xl border border-neutral-200 p-4 transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
						>
							{#if ws.avatarUrl}
								<img src={ws.avatarUrl} alt="" class="size-10 shrink-0 rounded-lg object-cover" />
							{:else}
								<div class="grid size-10 shrink-0 place-items-center rounded-lg text-lg font-bold text-white" style={`background:${ws.color || 'var(--color-brand-600)'}`}>
									{#if ws.icon}{ws.icon}{:else}{ws.name.slice(0, 1).toUpperCase()}{/if}
								</div>
							{/if}
							<div class="min-w-0 flex-1">
								<p class="truncate font-medium">{ws.name}</p>
								<p class="truncate text-xs text-neutral-500">
									{data.projectCounts[ws.id] ?? 0} project{(data.projectCounts[ws.id] ?? 0) === 1 ? '' : 's'}
								</p>
							</div>
							<ArrowRight size={16} class="text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500" />
						</a>
					{/each}
				</div>
			</section>

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
					<div class="rounded-xl border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-400 dark:border-neutral-700">
						No activity yet.
					</div>
				{/if}
			</aside>
		</div>
	{:else}
		<div class="rounded-xl border border-dashed border-neutral-300 py-16 text-center dark:border-neutral-700">
			<p class="text-sm text-neutral-500">You don't have any workspaces yet.</p>
			<div class="mt-4">
				<Button variant="primary" href="/w/new"><Plus size={16} /> Create your first workspace</Button>
			</div>
		</div>
	{/if}
</div>
