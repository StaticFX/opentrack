<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import GradualBlur from '$lib/components/vendor/GradualBlur.svelte';
	import { cn } from '$lib/utils/cn';
	import SettingsNavHeader from './SettingsNavHeader.svelte';

	// One visual, two routers: admin pages pass `href` items (real routes),
	// workspace/project/account pass `tab` items (?tab= deep links, pushState).
	export type SettingsNavItem = {
		label: string;
		icon?: Component;
		href?: string;
		tab?: string;
	};

	type Props = {
		scope: 'instance' | 'workspace' | 'project' | 'account';
		items: SettingsNavItem[];
		/** Current href (admin) or tab key (others). */
		active: string;
		backHref: string;
		backLabel: string;
		title: string;
		color?: string | null;
		icon?: string | null;
		avatarUrl?: string | null;
		children: Snippet;
	};
	let {
		scope,
		items,
		active,
		backHref,
		backLabel,
		title,
		color = null,
		icon = null,
		avatarUrl = null,
		children
	}: Props = $props();

	function hrefFor(item: SettingsNavItem): string {
		return item.tab != null ? `?tab=${item.tab}` : (item.href ?? '#');
	}
	function isActive(item: SettingsNavItem): boolean {
		if (item.tab != null) return active === item.tab;
		return item.href != null && (active === item.href || active.startsWith(`${item.href}/`));
	}
	// Tab links are a place-within-a-page — keepFocus/noScroll so switching
	// reads as a mode change, not a navigation. beforeNavigate (dirty.ts) still
	// intercepts this since it goes through the router either way.
	function onTabClick(e: MouseEvent, item: SettingsNavItem) {
		if (item.tab == null) return;
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		e.preventDefault();
		void goto(hrefFor(item), { keepFocus: true, noScroll: true });
	}
	// Esc backs out to the scope home — but only when nothing else (Dialog,
	// DropdownMenu, Select popup, modal Popover) already owns the key.
	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"], [aria-modal="true"]')) return;
		void goto(backHref);
	}

	const navItemClass = (isCurrent: boolean, pill = false) =>
		cn(
			'focus-ring flex h-8 shrink-0 items-center gap-2 text-[13px] transition-colors',
			pill ? 'snap-start rounded-full px-3 whitespace-nowrap' : 'rounded-[3px] px-2',
			isCurrent
				? 'bg-white/10 font-medium text-[var(--text)]'
				: 'text-[var(--dim)] hover:bg-white/5 hover:text-[var(--text)]'
		);
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="flex h-full min-w-0 flex-col lg:flex-row">
	<aside
		class="flex w-full shrink-0 flex-col bg-[var(--ground)] hairline-b lg:h-full lg:min-h-0 lg:w-56 lg:hairline-r lg:border-b-0"
	>
		<SettingsNavHeader {scope} {title} {backHref} {backLabel} {color} {icon} {avatarUrl} />

		<!-- Desktop: vertical list, sticky within its own scroll. -->
		<nav aria-label="Settings" class="mono-scroll hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-0.5 lg:overflow-y-auto lg:px-2 lg:pb-2">
			{#each items as item (item.label)}
				{@const current = isActive(item)}
				<a
					href={hrefFor(item)}
					aria-current={current ? 'page' : undefined}
					onclick={(e) => onTabClick(e, item)}
					class={navItemClass(current)}
				>
					{#if item.icon}<item.icon size={15} class="shrink-0 text-[var(--faint)]" aria-hidden="true" />{/if}
					<span class="truncate">{item.label}</span>
				</a>
			{/each}
		</nav>

		<!-- Mobile: snap-scroll pill row with edge fade. -->
		<div class="relative min-w-0 lg:hidden">
			<nav aria-label="Settings" class="flex snap-x gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none]">
				{#each items as item (item.label)}
					{@const current = isActive(item)}
					<a
						href={hrefFor(item)}
						aria-current={current ? 'page' : undefined}
						onclick={(e) => onTabClick(e, item)}
						class={navItemClass(current, true)}
					>
						{#if item.icon}<item.icon size={14} class="shrink-0 text-[var(--faint)]" aria-hidden="true" />{/if}
						{item.label}
					</a>
				{/each}
			</nav>
			<GradualBlur side="left" size={20} />
			<GradualBlur side="right" size={20} />
		</div>
	</aside>

	<div class="mono-scroll min-w-0 flex-1 overflow-y-auto">
		<div class="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
			{@render children()}
		</div>
	</div>
</div>
