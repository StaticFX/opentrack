<script lang="ts">
	import { page } from '$app/state';
	import {
		ChevronsUpDown,
		Plus,
		Settings,
		LogOut,
		LayoutDashboard,
		Shield,
		Hash,
		UserRound,
		Search
	} from '@lucide/svelte';
	import { ChevronLeft, ExternalLink } from '@lucide/svelte';
	import { clickOutside } from '$lib/utils/clickOutside';
	import { cn } from '$lib/utils/cn';
	import { PROJECT_NAV, isProjectNavActive } from '$lib/projectNav';
	import NotificationBell from './NotificationBell.svelte';

	type WsRef = {
		id: string;
		slug: string;
		name: string;
		icon?: string | null;
		color?: string | null;
		avatarUrl?: string | null;
	};
	type ProjectRef = { slug: string; name: string; color?: string | null };
	type ProjectCtx = { id: string; slug: string; name: string; color?: string | null; icon?: string | null };
	type BoardRef = { id: string; name: string };

	const pd = $derived(page.data as Record<string, unknown>);
	const user = $derived(pd.user as { displayName: string; avatarUrl: string | null; isAdmin: boolean });
	const workspaces = $derived((pd.workspaces ?? []) as WsRef[]);
	const currentWs = $derived(pd.workspace as WsRef | undefined);
	const projects = $derived((pd.projects ?? []) as ProjectRef[]);
	const canCreateProject = $derived(Boolean(pd.canCreateProject));
	const canManageWorkspace = $derived(Boolean(pd.canManageWorkspace));
	// Project context (present on any /w/[ws]/p/[proj]/… route) drives the
	// contextual project navigation that replaces the flat project list.
	const project = $derived(pd.project as ProjectCtx | undefined);
	const boards = $derived((pd.boards ?? []) as BoardRef[]);
	const canManageProject = $derived(Boolean(pd.canManageProject));
	const projNav = $derived(
		currentWs && project
			? PROJECT_NAV.filter((i) => !i.manageOnly || canManageProject)
			: []
	);

	let wsMenuOpen = $state(false);
	let userMenuOpen = $state(false);

	const isActive = (href: string) => page.url.pathname === href;

	/** Fallback letter shown when a workspace has no avatar or emoji icon. */
	const wsLetter = (ws?: WsRef) => (ws?.name ?? 'OT').slice(0, 1).toUpperCase();
	const initials = $derived(
		user.displayName
			.split(/\s+/)
			.map((w) => w[0])
			.slice(0, 2)
			.join('')
			.toUpperCase()
	);
</script>

{#snippet wsBadge(ws: WsRef | undefined, size: number)}
	{#if ws?.avatarUrl}
		<img src={ws.avatarUrl} alt="" class="shrink-0 rounded-md object-cover" style={`width:${size}px;height:${size}px`} />
	{:else}
		<div
			class="grid shrink-0 place-items-center rounded-md font-bold text-white"
			style={`width:${size}px;height:${size}px;font-size:${Math.round(size * 0.55)}px;background:${ws?.color ?? 'var(--color-brand-600)'}`}
		>
			{#if ws?.icon}{ws.icon}{:else}{wsLetter(ws)}{/if}
		</div>
	{/if}
{/snippet}

<aside
	class="flex h-screen w-60 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/40"
>
	<!-- Workspace switcher -->
	<div class="relative p-2">
		<button
			type="button"
			onclick={() => (wsMenuOpen = !wsMenuOpen)}
			class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
		>
			{@render wsBadge(currentWs, 24)}
			<span class="min-w-0 flex-1 truncate text-sm font-semibold">
				{currentWs?.name ?? 'OpenTrack'}
			</span>
			<ChevronsUpDown size={14} class="shrink-0 text-neutral-400" />
		</button>

		{#if wsMenuOpen}
			<div
				use:clickOutside={() => (wsMenuOpen = false)}
				class="absolute inset-x-2 top-full z-20 mt-1 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
			>
				<a
					href="/dashboard"
					onclick={() => (wsMenuOpen = false)}
					class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
				>
					<LayoutDashboard size={15} class="text-neutral-400" /> Dashboard
				</a>
				{#if workspaces.length}
					<div class="my-1 border-t border-neutral-100 dark:border-neutral-800"></div>
					{#each workspaces as ws (ws.id)}
						<a
							href={`/w/${ws.slug}`}
							onclick={() => (wsMenuOpen = false)}
							class={cn(
								'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800',
								currentWs?.id === ws.id && 'font-medium'
							)}
						>
							{@render wsBadge(ws, 18)}
							<span class="truncate">{ws.name}</span>
						</a>
					{/each}
				{/if}
				<div class="my-1 border-t border-neutral-100 dark:border-neutral-800"></div>
				<a
					href="/w/new"
					onclick={() => (wsMenuOpen = false)}
					class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
				>
					<Plus size={15} /> New workspace
				</a>
			</div>
		{/if}
	</div>

	<!-- Search (⌘K) -->
	<div class="px-2">
		<button
			type="button"
			onclick={() => window.dispatchEvent(new CustomEvent('command-palette'))}
			class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-neutral-500 hover:bg-neutral-200/60 dark:text-neutral-400 dark:hover:bg-neutral-800"
		>
			<Search size={15} class="text-neutral-400" />
			<span class="min-w-0 flex-1 truncate">Search…</span>
			<kbd class="shrink-0 rounded border border-neutral-200 px-1 text-[10px] text-neutral-400 dark:border-neutral-700">⌘K</kbd>
		</button>
	</div>

	<!-- Notifications -->
	<div class="px-2">
		<NotificationBell />
	</div>

	<!-- Nav -->
	<nav class="flex-1 overflow-y-auto px-2 py-1">
		{#if project && currentWs}
			{@const navBase = `/w/${currentWs.slug}/p/${project.slug}`}
			<!-- Back to the workspace's project list -->
			<a
				href={`/w/${currentWs.slug}`}
				class="mt-1 flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
			>
				<ChevronLeft size={13} /> {currentWs.name}
			</a>
			<!-- Current project badge -->
			<div class="mb-1 flex items-center gap-2 px-2 py-1.5">
				<span class="grid size-5 shrink-0 place-items-center rounded text-[11px] font-bold text-white" style={`background:${project.color ?? 'var(--color-brand-600)'}`}>
					{#if project.icon}{project.icon}{:else}{project.name.slice(0, 1).toUpperCase()}{/if}
				</span>
				<span class="min-w-0 flex-1 truncate text-sm font-semibold">{project.name}</span>
			</div>
			<!-- Overview -->
			{@const overviewItem = projNav.find((i) => i.key === 'overview')}
			{#if overviewItem}
				{@const OIcon = overviewItem.icon}
				<a
					href={navBase}
					class={cn(
						'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
						page.url.pathname === navBase
							? 'bg-neutral-200/70 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
							: 'text-neutral-600 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:bg-neutral-800/60'
					)}
				>
					<OIcon size={15} class="text-neutral-400" /> Overview
				</a>
			{/if}
			<!-- Boards -->
			<div class="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">Boards</div>
			{#each boards as b (b.id)}
				{@const href = `${navBase}/b/${b.id}`}
				<a
					{href}
					class={cn(
						'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
						page.url.pathname === href
							? 'bg-neutral-200/70 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
							: 'text-neutral-600 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:bg-neutral-800/60'
					)}
				>
					<Hash size={14} class="shrink-0 text-neutral-400" />
					<span class="truncate">{b.name}</span>
				</a>
			{/each}
			<!-- Other project sections -->
			<div class="mt-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
				{#each projNav.filter((i) => i.key !== 'overview') as item (item.key)}
					{@const href = item.href(currentWs.slug, project.slug)}
					{@const Icon = item.icon}
					<a
						{href}
						class={cn(
							'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
							!item.external && isProjectNavActive(item, page.url.pathname, currentWs.slug, project.slug)
								? 'bg-neutral-200/70 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
								: 'text-neutral-600 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:bg-neutral-800/60'
						)}
					>
						<Icon size={15} class="text-neutral-400" />
						<span class="flex-1 truncate">{item.label}</span>
						{#if item.external}<ExternalLink size={12} class="text-neutral-400" />{/if}
					</a>
				{/each}
			</div>
		{:else if currentWs}
			<div class="flex items-center justify-between px-2 pt-2 pb-1">
				<span class="text-xs font-medium tracking-wide text-neutral-400 uppercase">Projects</span>
				{#if canCreateProject}
					<a
						href={`/w/${currentWs.slug}/p/new`}
						class="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-800"
						aria-label="New project"
					>
						<Plus size={14} />
					</a>
				{/if}
			</div>
			{#each projects as p (p.slug)}
				{@const href = `/w/${currentWs.slug}/p/${p.slug}`}
				<a
					{href}
					class={cn(
						'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
						page.url.pathname.startsWith(href)
							? 'bg-neutral-200/70 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
							: 'text-neutral-600 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:bg-neutral-800/60'
					)}
				>
					<span
						class="size-2.5 shrink-0 rounded-full"
						style={`background:${p.color ?? '#9ca3af'}`}
					></span>
					<span class="truncate">{p.name}</span>
				</a>
			{:else}
				<p class="px-2 py-2 text-xs text-neutral-400">No projects yet.</p>
			{/each}

			{#if canManageWorkspace}
				<div class="mt-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
					<a
						href={`/w/${currentWs.slug}/settings`}
						class={cn(
							'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
							isActive(`/w/${currentWs.slug}/settings`)
								? 'bg-neutral-200/70 dark:bg-neutral-800'
								: 'text-neutral-600 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:bg-neutral-800/60'
						)}
					>
						<Settings size={15} class="text-neutral-400" /> Workspace settings
					</a>
				</div>
			{/if}
		{:else}
			<span class="px-2 pt-2 pb-1 text-xs font-medium tracking-wide text-neutral-400 uppercase">Workspaces</span>
			{#each workspaces as ws (ws.id)}
				<a
					href={`/w/${ws.slug}`}
					class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-600 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:bg-neutral-800/60"
				>
					<Hash size={14} class="text-neutral-400" />
					<span class="truncate">{ws.name}</span>
				</a>
			{:else}
				<p class="px-2 py-2 text-xs text-neutral-400">Create a workspace to get started.</p>
			{/each}
		{/if}
	</nav>

	<!-- Admin (visible to admins, always reachable) -->
	{#if user.isAdmin}
		<div class="px-2 pb-1">
			<a
				href="/admin"
				class={cn(
					'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
					page.url.pathname === '/admin'
						? 'bg-neutral-200/70 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
						: 'text-neutral-600 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:bg-neutral-800/60'
				)}
			>
				<Shield size={15} class="text-neutral-400" /> Admin
			</a>
		</div>
	{/if}

	<!-- User menu -->
	<div class="relative border-t border-neutral-200 p-2 dark:border-neutral-800">
		<button
			type="button"
			onclick={() => (userMenuOpen = !userMenuOpen)}
			class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
		>
			{#if user.avatarUrl}
				<img src={user.avatarUrl} alt="" class="size-6 rounded-full" />
			{:else}
				<div class="grid size-6 place-items-center rounded-full bg-neutral-300 text-[10px] font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
					{initials}
				</div>
			{/if}
			<span class="min-w-0 flex-1 truncate text-left text-sm">{user.displayName}</span>
			<ChevronsUpDown size={14} class="shrink-0 text-neutral-400" />
		</button>

		{#if userMenuOpen}
			<div
				use:clickOutside={() => (userMenuOpen = false)}
				class="absolute inset-x-2 bottom-full z-20 mb-1 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
			>
				<a
					href="/account"
					onclick={() => (userMenuOpen = false)}
					class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
				>
					<UserRound size={15} class="text-neutral-400" /> Account
				</a>
				<div class="my-1 border-t border-neutral-100 dark:border-neutral-800"></div>
				<form method="POST" action="/auth/logout">
					<button
						class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
					>
						<LogOut size={15} /> Sign out
					</button>
				</form>
			</div>
		{/if}
	</div>
</aside>
