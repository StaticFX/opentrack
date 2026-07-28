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
		CircleUser,
		Search
	} from '@lucide/svelte';
	import { ChevronLeft, ExternalLink, Sun, Moon, Monitor } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { clickOutside } from '$lib/utils/clickOutside';
	import { cn } from '$lib/utils/cn';
	import { PROJECT_NAV, isProjectNavActive } from '$lib/projectNav';
	import { getThemePref, setThemePref, watchSystemTheme, type ThemePref } from '$lib/theme';
	import NotificationBell from './NotificationBell.svelte';

	// Theme toggle (Light / System / Dark), persisted per browser.
	let themePref = $state<ThemePref>('system');
	onMount(() => {
		themePref = getThemePref();
		return watchSystemTheme();
	});
	function setTheme(p: ThemePref) {
		themePref = p;
		setThemePref(p);
	}
	const THEME_OPTIONS: Array<{ value: ThemePref; label: string; icon: typeof Sun }> = [
		{ value: 'light', label: 'Light', icon: Sun },
		{ value: 'system', label: 'System', icon: Monitor },
		{ value: 'dark', label: 'Dark', icon: Moon }
	];

	// `open` toggles the off-canvas drawer on mobile; `onnavigate` lets the parent
	// close the drawer when a non-link action (e.g. search) is triggered.
	let { open = false, onnavigate }: { open?: boolean; onnavigate?: () => void } = $props();

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
	const inboxOpenCount = $derived(Number(pd.inboxOpenCount ?? 0));
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
	class={cn(
		'ot-rail fixed inset-y-0 left-0 z-50 flex h-screen w-60 shrink-0 flex-col p-2 transition-transform duration-200 lg:static lg:z-auto lg:h-full lg:w-64 lg:translate-x-0 lg:rounded-2xl',
		open ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:shadow-none lg:shadow-[var(--ot-shadow-rail)]'
	)}
>
	<!-- Workspace switcher -->
	<div class="relative p-2">
		<button
			type="button"
			onclick={() => (wsMenuOpen = !wsMenuOpen)}
			class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/10"
		>
			{@render wsBadge(currentWs, 24)}
			<span class="min-w-0 flex-1 truncate text-sm font-semibold text-white">
				{currentWs?.name ?? 'OpenTrack'}
			</span>
			<ChevronsUpDown size={14} class="shrink-0 text-neutral-400" />
		</button>

		{#if wsMenuOpen}
			<div
				use:clickOutside={() => (wsMenuOpen = false)}
				class="absolute inset-x-2 top-full z-20 mt-1 rounded-lg border border-white/10 bg-neutral-800 p-1 text-neutral-200 shadow-xl"
			>
				<a
					href="/dashboard"
					onclick={() => (wsMenuOpen = false)}
					class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/10"
				>
					<LayoutDashboard size={15} class="text-neutral-400" /> Dashboard
				</a>
				{#if workspaces.length}
					<div class="my-1 border-t border-white/10"></div>
					{#each workspaces as ws (ws.id)}
						<a
							href={`/w/${ws.slug}`}
							onclick={() => (wsMenuOpen = false)}
							class={cn(
								'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/10',
								currentWs?.id === ws.id && 'font-medium text-white'
							)}
						>
							{@render wsBadge(ws, 18)}
							<span class="truncate">{ws.name}</span>
						</a>
					{/each}
				{/if}
				<div class="my-1 border-t border-white/10"></div>
				<a
					href="/w/new"
					onclick={() => (wsMenuOpen = false)}
					class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
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
			onclick={() => { onnavigate?.(); window.dispatchEvent(new CustomEvent('command-palette')); }}
			class="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
		>
			<Search size={15} class="text-neutral-400" />
			<span class="min-w-0 flex-1 truncate">Search…</span>
			<kbd class="shrink-0 rounded border border-white/10 bg-white/5 px-1 text-[10px] text-neutral-400">⌘K</kbd>
		</button>
	</div>

	<!-- My Work -->
	<div class="px-2">
		<a
			href="/my"
			class={cn(
				'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
				page.url.pathname === '/my'
					? 'bg-white/10 font-medium text-white shadow-[inset_2px_0_0_0_var(--color-brand-500)]'
					: 'text-neutral-300 hover:bg-white/10 hover:text-white'
			)}
		>
			<CircleUser size={15} class="text-neutral-400" /> My Work
		</a>
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
				class="mt-1 flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-400 hover:text-white"
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
							? 'bg-white/10 font-medium text-white shadow-[inset_2px_0_0_0_var(--color-brand-500)]'
							: 'text-neutral-300 hover:bg-white/10 hover:text-white'
					)}
				>
					<OIcon size={15} class="text-neutral-400" /> Overview
				</a>
			{/if}
			<!-- Boards: only show the section header once there's more than one. -->
			{#if boards.length > 1}
				<div class="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">Boards</div>
			{/if}
			{#each boards as b (b.id)}
				{@const href = `${navBase}/b/${b.id}`}
				<a
					{href}
					class={cn(
						'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
						page.url.pathname === href
							? 'bg-white/10 font-medium text-white shadow-[inset_2px_0_0_0_var(--color-brand-500)]'
							: 'text-neutral-300 hover:bg-white/10 hover:text-white'
					)}
				>
					<Hash size={14} class="shrink-0 text-neutral-400" />
					<span class="truncate">{b.name}</span>
				</a>
			{/each}
			<!-- Other project sections -->
			<div class="mt-2 border-t border-white/10 pt-2">
				{#each projNav.filter((i) => i.key !== 'overview') as item (item.key)}
					{@const href = item.href(currentWs.slug, project.slug)}
					{@const Icon = item.icon}
					<a
						{href}
						class={cn(
							'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
							!item.external && isProjectNavActive(item, page.url.pathname, currentWs.slug, project.slug)
								? 'bg-white/10 font-medium text-white shadow-[inset_2px_0_0_0_var(--color-brand-500)]'
								: 'text-neutral-300 hover:bg-white/10 hover:text-white'
						)}
					>
						<Icon size={15} class="text-neutral-400" />
						<span class="flex-1 truncate">{item.label}</span>
						{#if item.key === 'inbox' && inboxOpenCount > 0}
							<span class="min-w-4 shrink-0 rounded-full bg-brand-600 px-1.5 text-center text-[11px] font-semibold text-white tabular-nums">{inboxOpenCount > 99 ? '99+' : inboxOpenCount}</span>
						{/if}
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
						class="rounded p-0.5 text-neutral-400 hover:bg-white/10 hover:text-white"
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
							? 'bg-white/10 font-medium text-white shadow-[inset_2px_0_0_0_var(--color-brand-500)]'
							: 'text-neutral-300 hover:bg-white/10 hover:text-white'
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
				<div class="mt-2 border-t border-white/10 pt-2">
					<a
						href={`/w/${currentWs.slug}/settings`}
						class={cn(
							'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
							isActive(`/w/${currentWs.slug}/settings`)
								? 'bg-white/10 font-medium text-white shadow-[inset_2px_0_0_0_var(--color-brand-500)]'
								: 'text-neutral-300 hover:bg-white/10 hover:text-white'
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
					class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-300 hover:bg-white/10 hover:text-white"
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
						? 'bg-white/10 font-medium text-white shadow-[inset_2px_0_0_0_var(--color-brand-500)]'
						: 'text-neutral-300 hover:bg-white/10 hover:text-white'
				)}
			>
				<Shield size={15} class="text-neutral-400" /> Admin
			</a>
		</div>
	{/if}

	<!-- User menu -->
	<div class="relative mt-1 border-t border-white/10 p-2">
		<button
			type="button"
			onclick={() => (userMenuOpen = !userMenuOpen)}
			class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/10"
		>
			{#if user.avatarUrl}
				<img src={user.avatarUrl} alt="" class="size-6 rounded-full" />
			{:else}
				<div class="grid size-6 place-items-center rounded-full bg-neutral-600 text-[10px] font-semibold text-neutral-100">
					{initials}
				</div>
			{/if}
			<span class="min-w-0 flex-1 truncate text-left text-sm text-neutral-100">{user.displayName}</span>
			<ChevronsUpDown size={14} class="shrink-0 text-neutral-400" />
		</button>

		{#if userMenuOpen}
			<div
				use:clickOutside={() => (userMenuOpen = false)}
				class="absolute inset-x-2 bottom-full z-20 mb-1 rounded-lg border border-white/10 bg-neutral-800 p-1 text-neutral-200 shadow-xl"
			>
				<!-- Theme -->
				<div class="px-1 pt-0.5 pb-1">
					<span class="px-1 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">Theme</span>
					<div class="mt-1 flex gap-0.5 rounded-md bg-white/5 p-0.5">
						{#each THEME_OPTIONS as opt (opt.value)}
							{@const Icon = opt.icon}
							<button
								type="button"
								onclick={() => setTheme(opt.value)}
								aria-pressed={themePref === opt.value}
								title={opt.label}
								class={cn(
									'flex flex-1 items-center justify-center gap-1 rounded px-1.5 py-1 text-xs',
									themePref === opt.value
										? 'bg-white/10 font-medium text-white'
										: 'text-neutral-400 hover:text-neutral-200'
								)}
							>
								<Icon size={13} /> {opt.label}
							</button>
						{/each}
					</div>
				</div>
				<div class="my-1 border-t border-white/10"></div>
				<a
					href="/account"
					onclick={() => (userMenuOpen = false)}
					class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-300 hover:bg-white/10 hover:text-white"
				>
					<UserRound size={15} class="text-neutral-400" /> Account
				</a>
				<div class="my-1 border-t border-white/10"></div>
				<form method="POST" action="/auth/logout">
					<button
						class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/15"
					>
						<LogOut size={15} /> Sign out
					</button>
				</form>
			</div>
		{/if}
	</div>
</aside>
