<script lang="ts">
	import { Plus, Settings, Globe, Lock, FolderKanban } from '@lucide/svelte';
	import ViewHeader, { type Crumb } from '$lib/components/app/ViewHeader.svelte';
	import ActivityFeed from '$lib/components/app/ActivityFeed.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import AvatarStack from '$lib/components/ui/AvatarStack.svelte';
	import EmptyStateApp from '$lib/components/ui/EmptyStateApp.svelte';
	import Sparkline from '$lib/components/public/Sparkline.svelte';
	import { ago } from '$lib/time';

	let { data } = $props();
	const ws = $derived(data.workspace);
	const base = $derived(`/w/${ws.slug}`);

	const crumbs = $derived<Crumb[]>([{ label: ws.name, href: base, dot: ws.color ?? undefined }, { label: 'Overview' }]);

	// Project cards, activity-ranked (most recently touched first; quiet
	// projects with no activity sink to the bottom, order preserved among them).
	const rankedProjects = $derived(
		[...data.projects].sort((a, b) => {
			const av = data.projectVitals[a.slug]?.lastActivityAt;
			const bv = data.projectVitals[b.slug]?.lastActivityAt;
			if (!av && !bv) return 0;
			if (!av) return 1;
			if (!bv) return -1;
			return new Date(bv).getTime() - new Date(av).getTime();
		})
	);
</script>

<svelte:head><title>Overview · {ws.name} · OpenTrack</title></svelte:head>

<ViewHeader
	{crumbs}
	live={{ text: `${data.stats.openTickets} open` }}
	overflow={data.canManageWorkspace ? [{ label: 'Settings', icon: Settings, href: `${base}/settings` }] : []}
>
	{#snippet actions()}
		{#if data.canCreateProject}
			<Button variant="accent" size="sm" href={`${base}/p/new`}><Plus size={14} /> New project</Button>
		{/if}
	{/snippet}
</ViewHeader>

<div class="view-5xl">
	<!-- Identity line: mono-display name + inline mono vitals, no repeat of the ViewHeader crumb. -->
	<div class="mb-8 flex items-start gap-3">
		{#if ws.avatarUrl}
			<img src={ws.avatarUrl} alt="" class="size-9 shrink-0 rounded-sm object-cover" />
		{:else}
			<div
				class="mono-display grid size-9 shrink-0 place-items-center rounded-sm text-sm text-[var(--ground)]"
				style={`background:${ws.color || 'var(--accent)'}`}
			>
				{#if ws.icon}{ws.icon}{:else}{ws.name.slice(0, 1).toUpperCase()}{/if}
			</div>
		{/if}
		<div class="min-w-0">
			<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
				<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">{ws.name}</h2>
				{#if ws.visibility === 'public'}
					<Globe size={13} class="text-[var(--faint)]" aria-label="Public workspace" />
				{:else}
					<Lock size={13} class="text-[var(--faint)]" aria-label="Private workspace" />
				{/if}
			</div>
			{#if ws.description}<p class="mt-0.5 text-[13px] text-[var(--dim)]">{ws.description}</p>{/if}
			<p class="data-mono mt-1.5 text-[var(--dim)]">
				<a href="#projects" class="hover:text-[var(--accent)] hover:underline">{data.stats.projects} {data.stats.projects === 1 ? 'project' : 'projects'}</a>
				<span class="mx-1 text-[var(--faint)]">·</span>
				{#if data.canManageWorkspace}<a href={`${base}/settings`} class="hover:text-[var(--accent)] hover:underline">{data.stats.members} {data.stats.members === 1 ? 'person' : 'people'}</a
					>{:else}{data.stats.members} {data.stats.members === 1 ? 'person' : 'people'}{/if}
				<span class="mx-1 text-[var(--faint)]">·</span>
				{data.stats.openTickets} open
			</p>
		</div>
	</div>

	<div class="grid gap-8 lg:grid-cols-[1fr_20rem]">
		<!-- Projects: a hairline-divided directory row per project, no cards. -->
		<section id="projects" class="min-w-0">
			<h3 class="mb-3 text-[11px] font-medium tracking-[0.18em] text-[var(--faint)] uppercase">// Projects</h3>
			{#if rankedProjects.length}
				<div class="border-t border-[var(--rule)]">
					{#each rankedProjects as p (p.slug)}
						{@const vitals = data.projectVitals[p.slug]}
						<a
							href={`${base}/p/${p.slug}`}
							class="focus-ring group -mx-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--rule)] px-2 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)]"
						>
							<span class="flex shrink-0 items-baseline gap-1.5">
								<span aria-hidden="true" class="size-2.5 shrink-0 rounded-[3px]" style={`background:${p.color || 'var(--accent)'}`}></span>
								<span class="text-[14px] font-medium tracking-tight text-[var(--text)] transition-colors group-hover:text-[var(--accent)]">{p.name}</span>
								{#if p.visibility === 'private'}<Lock size={11} class="shrink-0 text-[var(--faint)]" />{/if}
							</span>
							{#if p.description}
								<span class="min-w-0 flex-1 truncate text-[12px] text-[var(--dim)]">— {p.description}</span>
							{:else}
								<span class="flex-1"></span>
							{/if}
							<span class="ml-auto flex shrink-0 items-center gap-3">
								{#if vitals}<span class="hidden sm:block"><Sparkline values={vitals.weekly.map((w) => w.opened + w.closed)} width={56} height={18} /></span>{/if}
								{#if vitals?.avatars.length}
									<AvatarStack users={vitals.avatars.map((a) => ({ name: a.name, src: a.avatarUrl }))} max={4} size={20} />
								{/if}
								<span class="data-mono shrink-0 text-[var(--faint)]">
									<span class="text-[var(--dim)]">{vitals?.openCount ?? 0}</span> open ·
									{vitals?.lastActivityAt ? `active ${ago(vitals.lastActivityAt)}` : 'quiet lately'}
								</span>
							</span>
						</a>
					{/each}
				</div>
			{:else}
				<EmptyStateApp
					icon={FolderKanban}
					title="No projects yet."
					body={data.canCreateProject ? 'Create one to start tracking work.' : undefined}
					action={data.canCreateProject ? { label: 'Create a project', href: `${base}/p/new` } : undefined}
				/>
			{/if}
		</section>

		<!-- Activity + collaborators -->
		<aside class="space-y-8">
			<section>
				<h3 class="mb-3 text-[11px] font-medium tracking-[0.18em] text-[var(--faint)] uppercase">// Activity</h3>
				<ActivityFeed items={data.activity} wsSlug={ws.slug} limit={12} dense emptyText="No activity yet." />
			</section>
			<section class="border-t border-[var(--rule)] pt-6">
				<h3 class="mb-3 text-[11px] font-medium tracking-[0.18em] text-[var(--faint)] uppercase">// Collaborators</h3>
				{#if data.members.length}
					<AvatarStack
						users={data.members.map((m) => ({ name: m.displayName, src: m.avatarUrl }))}
						max={8}
						size={32}
					/>
				{:else}
					<p class="text-[13px] text-[var(--faint)]">No members yet.</p>
				{/if}
				{#if data.canManageWorkspace}
					<a
						href={`${base}/settings`}
						class="focus-ring mt-3 inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-[var(--dim)] hover:text-[var(--text)]"
						><Plus size={13} /> Invite members</a
					>
				{/if}
			</section>
		</aside>
	</div>
</div>
