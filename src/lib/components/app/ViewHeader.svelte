<script lang="ts" module>
	import type { MenuItem } from '$lib/components/ui/DropdownMenu.svelte';

	export type CrumbMenuItem = { label: string; href: string; current?: boolean };
	export type Crumb = {
		label: string;
		href?: string;
		/** Accent color chip rendered before the label (project identity). */
		dot?: string;
		/** Renders a ▾ switcher on the crumb (sibling projects / boards + sections). */
		menu?: CrumbMenuItem[];
	};
	export type ViewHeaderLive = { text: string; beat?: boolean };
	export type { MenuItem };
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Check, ChevronDown, Ellipsis } from '@lucide/svelte';
	import { page } from '$app/state';
	import DropdownMenu from '$lib/components/ui/DropdownMenu.svelte';
	import Tabs, { type TabItem } from '$lib/components/ui/Tabs.svelte';
	import { PROJECT_NAV, isProjectNavActive } from '$lib/projectNav';
	import { cn } from '$lib/utils/cn';

	// The one header. Per-page import; pages own their `actions` snippet.
	type Props = {
		crumbs: Crumb[];
		/** ONE mono live fragment ("18 open") with a 6px breathing dot. */
		live?: ViewHeaderLive;
		/** Right edge: the single primary CTA. */
		actions?: Snippet;
		/** Board-only controls (search with `/` Kbd hint, Filter, Views). */
		toolbar?: Snippet;
		/** ⋯ menu holding rare actions (Archive toggle, Select mode). */
		overflow?: MenuItem[];
		/** <lg only: section tab row (h-10, snap-scroll) from PROJECT_NAV. */
		tabs?: boolean;
		/** Conditional second row (h-9) — filter chips + paused cues. */
		chips?: Snippet;
		class?: string;
	};
	let { crumbs, live, actions, toolbar, overflow, tabs = false, chips, class: klass }: Props = $props();

	// Frosted sticky surface on the mono ink ground (the bg-white/85 the public
	// map doesn't cover would otherwise flash near-white over the dark ground).
	const surface = 'bg-[color-mix(in_srgb,var(--raised)_88%,transparent)] backdrop-blur';

	const pd = $derived(page.data as Record<string, unknown>);
	const wsSlug = $derived((pd.workspace as { slug?: string } | undefined)?.slug ?? '');
	const projSlug = $derived((pd.project as { slug?: string } | undefined)?.slug ?? '');
	const canManageProject = $derived(Boolean(pd.canManageProject));

	const navItems = $derived(
		tabs && wsSlug && projSlug ? PROJECT_NAV.filter((i) => !i.manageOnly || canManageProject) : []
	);
	const tabItems: TabItem[] = $derived(
		navItems.map((i) => ({ key: i.key, label: i.label, href: i.href(wsSlug, projSlug) }))
	);
	const activeTab = $derived(
		navItems.find((i) => !i.external && isProjectNavActive(i, page.url.pathname, wsSlug, projSlug))?.key
	);

	const menuItems = (crumb: Crumb): MenuItem[] =>
		(crumb.menu ?? []).map((m) => ({ label: m.label, href: m.href, icon: m.current ? Check : undefined }));

	// Inverted crumb weighting: the section (last crumb) is the strongest element.
	const crumbText = (last: boolean) =>
		last
			? 'text-[13px] font-medium text-neutral-900 dark:text-neutral-100'
			: 'text-[13px] text-neutral-500 dark:text-neutral-400';
	const crumbBtn =
		'focus-ring -mx-0.5 flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800';
	const iconBtn =
		'focus-ring hit flex shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200';
</script>

{#snippet dotChip(color: string)}
	<span aria-hidden="true" class="size-2.5 shrink-0 rounded-[3px]" style={`background:${color}`}></span>
{/snippet}

<!-- Static below lg: the mobile chrome budget allows two sticky rows (top bar +
     the tab row / board pager), so the crumb row scrolls with the page there. -->
<header
	class={cn(
		'sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 px-3 max-lg:static',
		surface,
		'hairline-b',
		klass
	)}
>
	<nav aria-label="Breadcrumb" class="flex min-w-0 items-center gap-1">
		{#each crumbs as crumb, i (i)}
			{@const last = i === crumbs.length - 1}
			{#if i > 0}
				<span aria-hidden="true" class="hidden shrink-0 text-neutral-300 lg:inline dark:text-neutral-600">/</span>
			{/if}
			<!-- Mobile: crumbs collapse to the section (last) crumb. -->
			<span class={cn('min-w-0 items-center gap-1', last ? 'flex' : 'hidden lg:flex')}>
				{#if crumb.menu?.length && !crumb.href}
					<DropdownMenu items={menuItems(crumb)} ariaLabel={`Switch ${crumb.label}`}>
						{#snippet trigger(tp)}
							<button type="button" {...tp} class={cn(crumbBtn, crumbText(last))}>
								{#if crumb.dot}{@render dotChip(crumb.dot)}{/if}
								<span class="truncate">{crumb.label}</span>
								<ChevronDown size={12} class="shrink-0 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
							</button>
						{/snippet}
					</DropdownMenu>
				{:else}
					{#if crumb.href}
						<a
							href={crumb.href}
							class={cn(
								crumbBtn,
								crumbText(last),
								!last && 'hover:text-neutral-900 dark:hover:text-neutral-100'
							)}
						>
							{#if crumb.dot}{@render dotChip(crumb.dot)}{/if}
							<span class="truncate">{crumb.label}</span>
						</a>
					{:else}
						<span class={cn('flex min-w-0 items-center gap-1.5 px-0.5', crumbText(last))}>
							{#if crumb.dot}{@render dotChip(crumb.dot)}{/if}
							<span class="truncate">{crumb.label}</span>
						</span>
					{/if}
					{#if crumb.menu?.length}
						<DropdownMenu items={menuItems(crumb)} ariaLabel={`Switch ${crumb.label}`}>
							{#snippet trigger(tp)}
								<button type="button" {...tp} class={cn(iconBtn, 'size-6')} aria-label={`Switch ${crumb.label}`}>
									<ChevronDown size={12} aria-hidden="true" />
								</button>
							{/snippet}
						</DropdownMenu>
					{/if}
				{/if}
			</span>
		{/each}
	</nav>

	{#if live}
		<span class="data-mono ml-2 flex shrink-0 items-center gap-1.5 whitespace-nowrap text-neutral-500 dark:text-neutral-400">
			<span class="relative flex size-1.5" aria-hidden="true">
				{#if live.beat}
					<span class="ot-breathe absolute inline-flex size-full rounded-full bg-[var(--accent-solid)] opacity-60"></span>
				{/if}
				<span class="relative inline-flex size-1.5 rounded-full bg-[var(--accent-solid)]"></span>
			</span>
			{live.text}
		</span>
	{/if}

	<div class="min-w-2 flex-1"></div>

	{#if toolbar}{@render toolbar()}{/if}

	{#if overflow?.length}
		<DropdownMenu items={overflow} placement="bottom-end" ariaLabel="More actions">
			{#snippet trigger(tp)}
				<button type="button" {...tp} class={cn(iconBtn, 'size-7')} aria-label="More actions">
					<Ellipsis size={15} aria-hidden="true" />
				</button>
			{/snippet}
		</DropdownMenu>
	{/if}

	{#if actions}<div class="flex shrink-0 items-center gap-2">{@render actions()}</div>{/if}
</header>

{#if tabItems.length > 0}
	<div class={cn('hairline-b sticky top-0 z-30 lg:hidden', surface)}>
		<Tabs items={tabItems} value={activeTab} ariaLabel="Project sections" class="h-10 snap-x px-2" />
	</div>
{/if}

{#if chips}
	<div
		class={cn('hairline-b z-20 flex h-9 items-center gap-2 px-3 lg:sticky lg:top-12', surface)}
	>
		{@render chips()}
	</div>
{/if}
