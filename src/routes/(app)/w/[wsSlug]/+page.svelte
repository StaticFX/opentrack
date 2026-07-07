<script lang="ts">
	import {
		Plus,
		Settings,
		Globe,
		Lock,
		FolderKanban,
		Users,
		CircleDot,
		Lightbulb,
		Tag,
		ArrowRight,
		CircleCheck,
		MessageSquare,
		Activity as ActivityIcon
	} from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';

	let { data } = $props();
	const ws = $derived(data.workspace);
	const base = $derived(`/w/${ws.slug}`);

	const stats = $derived([
		{ label: 'Projects', value: data.stats.projects, icon: FolderKanban },
		{ label: 'Collaborators', value: data.stats.members, icon: Users },
		{ label: 'Open tickets', value: data.stats.openTickets, icon: CircleDot }
	]);

	function initials(name: string) {
		return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
	}

	// ── Activity formatting (shared shape with the project feeds) ──
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

<svelte:head><title>{ws.name} · OpenTrack</title></svelte:head>

<div class="mx-auto max-w-5xl px-8 py-8">
	<!-- Header -->
	<header class="mb-8 flex items-start justify-between gap-4">
		<div class="flex items-center gap-3">
			{#if ws.avatarUrl}
				<img src={ws.avatarUrl} alt="" class="size-11 shrink-0 rounded-xl object-cover" />
			{:else}
				<div class="grid size-11 shrink-0 place-items-center rounded-xl text-lg font-bold text-white" style={`background:${ws.color || 'var(--color-brand-600)'}`}>
					{#if ws.icon}{ws.icon}{:else}{ws.name.slice(0, 1).toUpperCase()}{/if}
				</div>
			{/if}
			<div class="min-w-0">
				<div class="flex items-center gap-2">
					<h1 class="text-xl font-semibold tracking-tight">{ws.name}</h1>
					{#if ws.visibility === 'public'}
						<Globe size={14} class="text-neutral-400" />
					{:else}
						<Lock size={14} class="text-neutral-400" />
					{/if}
				</div>
				{#if ws.description}
					<p class="mt-0.5 text-sm text-neutral-500">{ws.description}</p>
				{/if}
			</div>
		</div>
		<div class="flex shrink-0 gap-2">
			{#if data.canManageWorkspace}
				<Button variant="ghost" size="icon" href={`${base}/settings`} aria-label="Settings"><Settings size={16} /></Button>
			{/if}
			{#if data.canCreateProject}
				<Button variant="primary" href={`${base}/p/new`}><Plus size={16} /> New project</Button>
			{/if}
		</div>
	</header>

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

	<div class="grid gap-8 lg:grid-cols-[1fr_18rem]">
		<!-- Projects + activity -->
		<div class="min-w-0 space-y-8">
			<!-- Projects -->
			<section>
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-sm font-semibold">Projects</h2>
					{#if data.canCreateProject && data.projects.length}
						<a href={`${base}/p/new`} class="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700"><Plus size={13} /> New</a>
					{/if}
				</div>
				{#if data.projects.length}
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						{#each data.projects as p (p.slug)}
							<a
								href={`${base}/p/${p.slug}`}
								class="group rounded-xl border border-neutral-200 p-4 transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
							>
								<div class="flex items-center gap-2.5">
									<div class="grid size-7 shrink-0 place-items-center rounded-md text-sm font-bold text-white" style={`background:${p.color ?? '#9ca3af'}`}>
										{#if p.icon}{p.icon}{:else}{p.name.slice(0, 1).toUpperCase()}{/if}
									</div>
									<span class="min-w-0 flex-1 truncate font-medium">{p.name}</span>
									{#if p.visibility === 'private'}
										<Lock size={12} class="shrink-0 text-neutral-400" />
									{/if}
								</div>
								{#if p.description}
									<p class="mt-2 line-clamp-2 text-sm text-neutral-500">{p.description}</p>
								{/if}
							</a>
						{/each}
					</div>
				{:else}
					<div class="rounded-xl border border-dashed border-neutral-300 py-14 text-center dark:border-neutral-700">
						<p class="text-sm text-neutral-500">No projects in this workspace yet.</p>
						{#if data.canCreateProject}
							<div class="mt-4">
								<Button variant="primary" href={`${base}/p/new`}><Plus size={16} /> Create a project</Button>
							</div>
						{/if}
					</div>
				{/if}
			</section>

			<!-- Recent activity -->
			<section>
				<h2 class="mb-3 text-sm font-semibold">Recent activity</h2>
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
									{#if a.projectName}<span class="text-neutral-400"> in {a.projectName}</span>{/if}
									<span class="ml-1 text-xs text-neutral-400">· {ago(a.createdAt)}</span>
								</p>
							</li>
						{/each}
					</ul>
				{:else}
					<div class="rounded-xl border border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-400 dark:border-neutral-700">
						No activity yet.
					</div>
				{/if}
			</section>
		</div>

		<!-- Members aside -->
		<aside class="space-y-6">
			<section>
				<h2 class="mb-3 text-sm font-semibold">Collaborators</h2>
				{#if data.members.length}
					<ul class="space-y-2">
						{#each data.members as m (m.userId)}
							<li class="flex items-center gap-2.5">
								{#if m.avatarUrl}
									<img src={m.avatarUrl} alt="" class="size-7 rounded-full" />
								{:else}
									<div class="grid size-7 place-items-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-200">{initials(m.displayName)}</div>
								{/if}
								<p class="min-w-0 flex-1 truncate text-sm">{m.displayName}</p>
								<span class="text-xs capitalize text-neutral-400">{m.role}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-sm text-neutral-400">No members yet.</p>
				{/if}
				{#if data.canManageWorkspace}
					<a href={`${base}/settings`} class="mt-3 inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700"><Plus size={13} /> Invite members</a>
				{/if}
			</section>
		</aside>
	</div>
</div>
