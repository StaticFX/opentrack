<script lang="ts">
	import { page } from '$app/state';
	import {
		Check,
		ChevronsUpDown,
		CircleUser,
		Hash,
		House,
		LayoutDashboard,
		LogOut,
		PanelLeftClose,
		PanelLeftOpen,
		Plus,
		Search,
		Settings,
		Shield,
		UserRound
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { clickOutside } from '$lib/utils/clickOutside';
	import { cn } from '$lib/utils/cn';
	import { PROJECT_NAV, activeMatch } from '$lib/projectNav';
	import DropdownMenu, { type MenuItem } from '$lib/components/ui/DropdownMenu.svelte';
	import Kbd from '$lib/components/ui/Kbd.svelte';
	import Tooltip from '$lib/components/ui/Tooltip.svelte';
	import NavRow from './NavRow.svelte';
	import NotificationBell from './NotificationBell.svelte';

	// 'rail' = the desktop column (hidden < lg); 'drawer' = the same content
	// inside the mobile Sheet. `onnavigate` lets the parent close the drawer
	// when a non-link action (e.g. search) is triggered.
	let { mode = 'rail', onnavigate }: { mode?: 'rail' | 'drawer'; onnavigate?: () => void } =
		$props();

	type WsRef = {
		id: string;
		slug: string;
		name: string;
		icon?: string | null;
		color?: string | null;
		avatarUrl?: string | null;
	};
	type ProjectRef = { slug: string; name: string; color?: string | null; openCount?: number };
	type ProjectCtx = { id: string; slug: string; name: string; color?: string | null; icon?: string | null };
	type BoardRef = { id: string; name: string };

	const pd = $derived(page.data as Record<string, unknown>);
	const user = $derived(pd.user as { displayName: string; avatarUrl: string | null; isAdmin: boolean });
	const workspaces = $derived((pd.workspaces ?? []) as WsRef[]);
	const currentWs = $derived(pd.workspace as WsRef | undefined);
	const projects = $derived((pd.projects ?? []) as ProjectRef[]);
	const canCreateProject = $derived(Boolean(pd.canCreateProject));
	const canManageWorkspace = $derived(Boolean(pd.canManageWorkspace));
	// Project context (present on any /w/[ws]/p/[proj]/… route) expands that
	// project's subtree in place — sibling projects stay visible.
	const project = $derived(pd.project as ProjectCtx | undefined);
	const boards = $derived((pd.boards ?? []) as BoardRef[]);
	const canManageProject = $derived(Boolean(pd.canManageProject));
	const inboxOpenCount = $derived(Number(pd.inboxOpenCount ?? 0));
	const projNav = $derived(
		currentWs && project ? PROJECT_NAV.filter((i) => !i.manageOnly || canManageProject) : []
	);

	const path = $derived(page.url.pathname);
	const search = $derived(page.url.search);

	// `[` collapse — 56px icon rail, persisted; /admin auto-collapses (the admin
	// pages carry their own secondary nav) without overwriting the stored pref.
	const RAIL_KEY = 'ot-rail';
	let storedCollapsed = $state(false);
	let adminExpand = $state(false);
	onMount(() => {
		try {
			storedCollapsed = localStorage.getItem(RAIL_KEY) === 'collapsed';
		} catch {
			/* storage unavailable */
		}
	});
	const onAdmin = $derived(path === '/admin' || path.startsWith('/admin/'));
	$effect(() => {
		if (!onAdmin) adminExpand = false;
	});
	const collapsed = $derived(mode === 'rail' && (onAdmin ? !adminExpand : storedCollapsed));
	function toggleCollapsed() {
		if (onAdmin) {
			adminExpand = collapsed;
			return;
		}
		storedCollapsed = !storedCollapsed;
		try {
			localStorage.setItem(RAIL_KEY, storedCollapsed ? 'collapsed' : 'open');
		} catch {
			/* storage unavailable */
		}
	}

	const isEditable = (el: EventTarget | null) => {
		const n = el as HTMLElement | null;
		if (!n) return false;
		return n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.isContentEditable;
	};
	function onWindowKeydown(e: KeyboardEvent) {
		if (mode !== 'rail') return;
		if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey || isEditable(e.target)) return;
		e.preventDefault();
		toggleCollapsed();
	}

	let userMenuOpen = $state(false);

	function openPalette() {
		onnavigate?.();
		window.dispatchEvent(new CustomEvent('command-palette'));
	}

	const wsMenuItems = $derived.by<MenuItem[]>(() => {
		const items: MenuItem[] = [{ label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' }];
		for (const ws of workspaces)
			items.push({
				label: ws.name,
				href: `/w/${ws.slug}`,
				icon: currentWs?.id === ws.id ? Check : undefined
			});
		items.push({ label: 'New workspace', icon: Plus, href: '/w/new' });
		return items;
	});

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

	const adminActive = $derived(onAdmin);
	// Quiet uppercase section label — mono, faint.
	const railLabel =
		'px-2 text-[11px] font-semibold tracking-wide uppercase text-[var(--faint)]';
	// Popover surface (user menu) — flat raised ink, hairline, sharp corners.
	const pop = 'rounded-[4px] border border-[var(--rule)] bg-[var(--raised)] p-1.5 text-[var(--text)]';
	const popItem =
		'focus-ring flex items-center gap-2 rounded-[2px] px-2 py-1.5 text-[13px] transition-colors hover:bg-white/10';
	// Collapsed icon-rail button voice.
	const iconBtn =
		'focus-ring hit relative grid size-9 place-items-center rounded-md transition-colors text-[var(--dim)] hover:bg-white/5 hover:text-[var(--text)]';
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

{#snippet projectTile(p: ProjectCtx)}
	{@const projColor = p.color ?? 'var(--color-brand-600)'}
	<span
		class="grid size-5 shrink-0 place-items-center rounded-[3px] text-[10px] font-bold text-white"
		style={`background:${projColor}`}
	>
		{#if p.icon}{p.icon}{:else}{p.name.slice(0, 1).toUpperCase()}{/if}
	</span>
{/snippet}

{#snippet collapseToggle()}
	<Tooltip label={collapsed ? 'Expand · [' : 'Collapse · ['} side="right">
		<button
			type="button"
			onclick={toggleCollapsed}
			aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			class={cn(iconBtn, !collapsed && 'size-7 rounded-md')}
		>
			{#if collapsed}<PanelLeftOpen size={15} />{:else}<PanelLeftClose size={15} />{/if}
		</button>
	</Tooltip>
{/snippet}

<svelte:window onkeydown={onWindowKeydown} />

<!-- Flat ink rail: the mono ground with a hairline right border as the only
     split from the content region. Cobalt lands solely on the active NavRow bar
     and counts. -->
<aside
	class={cn(
		'texture-dots flex-col bg-[var(--ground)] p-2 text-[var(--text)]',
		mode === 'drawer'
			? 'flex h-full w-full'
			: cn(
					'hidden h-full shrink-0 lg:flex lg:hairline-r',
					'transition-[width] duration-200 [transition-timing-function:var(--ease-out-quint)] motion-reduce:transition-none',
					collapsed ? 'w-14' : 'w-64'
				)
	)}
>
	{#if collapsed}
		<!-- 56px icon rail: every control keeps its function; tooltips carry labels. -->
		<div class="flex flex-col items-center gap-1">
			<DropdownMenu items={wsMenuItems} ariaLabel="Workspaces" placement="bottom-start">
				{#snippet trigger(t)}
					<Tooltip label={currentWs?.name ?? 'Workspaces'} side="right">
						<button type="button" {...t} class={iconBtn} aria-label="Switch workspace">
							{@render wsBadge(currentWs, 24)}
						</button>
					</Tooltip>
				{/snippet}
			</DropdownMenu>
			<div class="my-1 w-6 border-t border-white/8"></div>
			<Tooltip label="Home" side="right">
				<a
					href="/dashboard"
					aria-current={path === '/dashboard' ? 'page' : undefined}
					aria-label="Home"
					class={cn(iconBtn, path === '/dashboard' && 'bg-white/10 text-white')}
				>
					<House size={16} />
				</a>
			</Tooltip>
			<Tooltip label="My Work" side="right">
				<a
					href="/my"
					aria-current={path === '/my' ? 'page' : undefined}
					aria-label="My Work"
					class={cn(iconBtn, path === '/my' && 'bg-white/10 text-white')}
				>
					<CircleUser size={16} />
				</a>
			</Tooltip>
			<NotificationBell collapsed />
			<Tooltip label="Search · ⌘K" side="right">
				<button type="button" onclick={openPalette} aria-label="Search" class={iconBtn}>
					<Search size={16} />
				</button>
			</Tooltip>
		</div>

		<div class="mx-auto my-2 w-6 border-t border-white/8"></div>

		<nav class="flex flex-1 flex-col items-center gap-1 overflow-y-auto" aria-label="Projects">
			{#if currentWs}
				{#each projects as p (p.slug)}
					{@const active = project?.slug === p.slug}
					<Tooltip label={p.name} side="right">
						<a
							href={`/w/${currentWs.slug}/p/${p.slug}`}
							aria-label={p.name}
							aria-current={active ? 'page' : undefined}
							class={cn(iconBtn, active && 'bg-white/10')}
						>
							<span
								class={cn('size-2.5 rounded-full ring-1 ring-white/10', active && 'ring-white/40')}
								style={`background:${p.color ?? '#9ca3af'}`}
							></span>
						</a>
					</Tooltip>
				{/each}
			{:else}
				{#each workspaces as ws (ws.id)}
					<Tooltip label={ws.name} side="right">
						<a href={`/w/${ws.slug}`} aria-label={ws.name} class={iconBtn}>
							{@render wsBadge(ws, 20)}
						</a>
					</Tooltip>
				{/each}
			{/if}
		</nav>

		<div class="flex flex-col items-center gap-1 pt-1">
			{#if user.isAdmin}
				<Tooltip label="Admin" side="right">
					<a
						href="/admin"
						aria-label="Admin"
						aria-current={adminActive ? 'page' : undefined}
						class={cn(iconBtn, adminActive && 'bg-white/10 text-white')}
					>
						<Shield size={16} />
					</a>
				</Tooltip>
			{/if}
			{@render collapseToggle()}
			<div class="relative">
				<Tooltip label={user.displayName} side="right">
					<button
						type="button"
						onclick={() => (userMenuOpen = !userMenuOpen)}
						aria-label="User menu"
						aria-haspopup="true"
						aria-expanded={userMenuOpen}
						class={iconBtn}
					>
						{#if user.avatarUrl}
							<img src={user.avatarUrl} alt="" class="size-6 rounded-full ring-1 ring-white/15" />
						{:else}
							<span
								class="grid size-6 place-items-center rounded-full bg-neutral-600 text-[10px] font-semibold text-neutral-100 ring-1 ring-white/15"
							>
								{initials}
							</span>
						{/if}
					</button>
				</Tooltip>
				{#if userMenuOpen}
					<div use:clickOutside={() => (userMenuOpen = false)} class={cn(pop, 'absolute bottom-full left-0 z-20 mb-1 w-56')}>
						{@render userMenu()}
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Workspace identity + switcher -->
		<div class="flex items-center gap-1 p-2 pb-1">
			<div class="min-w-0 flex-1 *:w-full">
				<DropdownMenu items={wsMenuItems} ariaLabel="Workspaces" placement="bottom-start" class="w-full">
					{#snippet trigger(t)}
						<button
							type="button"
							{...t}
							class="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
						>
							{@render wsBadge(currentWs, 26)}
							<span class="min-w-0 flex-1 truncate font-display text-sm font-semibold tracking-tight text-white">
								{currentWs?.name ?? 'OpenTrack'}
							</span>
							<ChevronsUpDown size={14} class="shrink-0 text-neutral-500" />
						</button>
					{/snippet}
				</DropdownMenu>
			</div>
			{#if mode === 'rail'}{@render collapseToggle()}{/if}
		</div>

		<div class="mx-2 border-t border-white/8"></div>

		<!-- Personal cluster -->
		<div class="mt-2 flex flex-col gap-0.5 px-2">
			<NavRow href="/dashboard" icon={House} label="Home" active={path === '/dashboard'} />
			<NavRow href="/my" icon={CircleUser} label="My Work" active={path === '/my'} />
			<NotificationBell />
			<button
				type="button"
				onclick={openPalette}
				class="focus-ring flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
			>
				<Search size={15} class="shrink-0 text-neutral-400" />
				<span class="min-w-0 flex-1 truncate">Search</span>
				<Kbd keys={['⌘', 'K']} class="shrink-0 text-neutral-400" />
			</button>
		</div>

		<!-- Projects tree: siblings always visible, the active project expands in place. -->
		<nav class="mt-2 flex-1 overflow-y-auto border-t border-white/8 px-2 pt-2 pb-1" aria-label="Projects">
			{#if currentWs}
				<div class="flex items-center justify-between pb-1">
					<span class={railLabel}>Projects</span>
					{#if canCreateProject}
						<a
							href={`/w/${currentWs.slug}/p/new`}
							class="focus-ring hit grid size-7 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
							aria-label="New project"
						>
							<Plus size={14} />
						</a>
					{/if}
				</div>
				{#each projects as p (p.slug)}
					{@const href = `/w/${currentWs.slug}/p/${p.slug}`}
					{#if project && project.slug === p.slug}
						<!-- Expanded subtree for the project we're inside. -->
						<a
							href={href}
							class="focus-ring flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-white transition-colors hover:bg-white/5"
						>
							{@render projectTile(project)}
							<span class="min-w-0 flex-1 truncate">{p.name}</span>
							{#if typeof p.openCount === 'number'}
								<span class="data-mono shrink-0 text-neutral-400">{p.openCount}</span>
							{/if}
						</a>
						{#each projNav.filter((i) => i.key === 'overview') as item (item.key)}
							<NavRow
								depth={1}
								href={href}
								icon={item.icon}
								label={item.label}
								active={activeMatch(item, path, search, currentWs.slug, project.slug, boards)}
							/>
						{/each}
						{#each boards as b (b.id)}
							<NavRow
								depth={1}
								href={`${href}/b/${b.id}`}
								icon={Hash}
								label={b.name}
								active={activeMatch({ key: `board:${b.id}` }, path, search, currentWs.slug, project.slug, boards)}
							/>
						{/each}
						{#each projNav.filter((i) => i.key !== 'overview') as item (item.key)}
							<NavRow
								depth={1}
								href={item.href(currentWs.slug, project.slug)}
								icon={item.icon}
								label={item.label}
								external={item.external}
								badge={item.key === 'inbox' && inboxOpenCount > 0 ? inboxOpenCount : undefined}
								badgeTone="accent"
								active={activeMatch(item, path, search, currentWs.slug, project.slug, boards)}
							/>
						{/each}
					{:else}
						<!-- Collapsed sibling: colour dot + name + open count, click = overview. -->
						<NavRow
							{href}
							dot={p.color ?? '#9ca3af'}
							label={p.name}
							badge={typeof p.openCount === 'number' ? p.openCount : undefined}
							active={path.startsWith(href)}
						/>
					{/if}
				{:else}
					<p class="px-2 py-2 text-xs text-neutral-400">No projects yet.</p>
				{/each}

				{#if canManageWorkspace}
					<div class="mt-2 border-t border-white/8 pt-2">
						<NavRow
							href={`/w/${currentWs.slug}/settings`}
							icon={Settings}
							label="Workspace settings"
							active={path === `/w/${currentWs.slug}/settings`}
						/>
					</div>
				{/if}
			{:else}
				<span class={cn('block pb-1', railLabel)}>Workspaces</span>
				{#each workspaces as ws (ws.id)}
					<NavRow href={`/w/${ws.slug}`} icon={Hash} label={ws.name} active={path === `/w/${ws.slug}`} />
				{:else}
					<p class="px-2 py-2 text-xs text-neutral-400">Create a workspace to get started.</p>
				{/each}
			{/if}
		</nav>

		<!-- Admin (visible to admins, always reachable) -->
		{#if user.isAdmin}
			<div class="px-2 pb-1">
				<NavRow href="/admin" icon={Shield} label="Admin" active={adminActive} />
			</div>
		{/if}

		<!-- User menu -->
		<div class="relative mt-1 border-t border-white/8 p-2">
			<button
				type="button"
				onclick={() => (userMenuOpen = !userMenuOpen)}
				aria-haspopup="true"
				aria-expanded={userMenuOpen}
				class="focus-ring flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5"
			>
				{#if user.avatarUrl}
					<img src={user.avatarUrl} alt="" class="size-6 shrink-0 rounded-full ring-1 ring-white/15" />
				{:else}
					<div
						class="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-600 text-[10px] font-semibold text-neutral-100 ring-1 ring-white/15"
					>
						{initials}
					</div>
				{/if}
				<span class="min-w-0 flex-1 truncate text-left text-[13px] text-neutral-100">{user.displayName}</span>
				<ChevronsUpDown size={14} class="shrink-0 text-neutral-500" />
			</button>

			{#if userMenuOpen}
				<div use:clickOutside={() => (userMenuOpen = false)} class={cn(pop, 'absolute inset-x-2 bottom-full z-20 mb-1')}>
					{@render userMenu()}
				</div>
			{/if}
		</div>
	{/if}
</aside>

{#snippet userMenu()}
	<!-- The app commits to dark mono, so there is no light/dark theme toggle. -->
	<a
		href="/account"
		onclick={() => (userMenuOpen = false)}
		class={cn(popItem, 'text-[var(--dim)] hover:text-[var(--text)]')}
	>
		<UserRound size={15} class="text-[var(--faint)]" /> Account
	</a>
	<div class="my-1 border-t border-[var(--rule)]"></div>
	<form method="POST" action="/auth/logout">
		<button
			class="focus-ring flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 text-[13px] text-red-400 transition-colors hover:bg-red-500/15"
		>
			<LogOut size={15} /> Sign out
		</button>
	</form>
{/snippet}
