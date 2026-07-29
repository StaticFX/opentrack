<script lang="ts" module>
	import type { Component } from 'svelte';

	export type MenuItem = {
		label: string;
		icon?: Component;
		href?: string;
		onselect?: () => void;
		danger?: boolean;
		/** Shortcut hint, rendered right-aligned as <Kbd>. */
		kbd?: string | string[];
	};
	export type MenuPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
	/** Spread onto the trigger element inside the `trigger` snippet. */
	export type MenuTriggerProps = {
		'aria-haspopup': 'menu';
		'aria-expanded': boolean;
		'aria-controls': string | undefined;
		onclick: () => void;
		onkeydown: (e: KeyboardEvent) => void;
	};
</script>

<script lang="ts">
	import { flushSync, tick } from 'svelte';
	import type { Snippet } from 'svelte';
	import Kbd from './Kbd.svelte';
	import { clickOutside } from '$lib/utils/clickOutside';
	import { cn } from '$lib/utils/cn';

	type Props = {
		items: MenuItem[];
		trigger: Snippet<[MenuTriggerProps]>;
		placement?: MenuPlacement;
		ariaLabel?: string;
		class?: string;
	};
	let { items, trigger, placement = 'bottom-start', ariaLabel = 'Menu', class: klass }: Props = $props();

	const uid = $props.id();
	const menuId = `${uid}-menu`;

	let open = $state(false);
	let wrapper = $state<HTMLDivElement>();
	let panel = $state<HTMLDivElement>();
	let flipped = $state(false);
	let shift = $state(0);
	let returnEl: HTMLElement | null = null;

	const above = $derived(placement.startsWith('top') !== flipped);
	const alignEnd = $derived(placement.endsWith('end'));

	function itemEls(): HTMLElement[] {
		return panel ? Array.from(panel.querySelectorAll<HTMLElement>('[role="menuitem"]')) : [];
	}

	async function openMenu(focusIndex: number) {
		if (open || items.length === 0) return;
		returnEl = document.activeElement as HTMLElement | null;
		flipped = false;
		shift = 0;
		open = true;
		await tick();
		const els = itemEls();
		els[focusIndex === -1 ? els.length - 1 : focusIndex]?.focus();
	}

	function closeMenu(returnFocus: boolean) {
		open = false;
		if (returnFocus) returnEl?.focus?.();
	}

	// Close + hand focus back BEFORE the action runs, so anything the action
	// opens (a Dialog) records the trigger as its own focus-restore point.
	function select(item: MenuItem) {
		closeMenu(true);
		item.onselect?.();
	}

	function onTriggerKeydown(e: KeyboardEvent) {
		if (open) return; // focus lives in the menu once open
		if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			openMenu(0);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			openMenu(-1);
		}
	}

	let typed = '';
	let typedAt = 0;

	function onMenuKeydown(e: KeyboardEvent) {
		const els = itemEls();
		if (els.length === 0) return;
		const cur = els.indexOf(document.activeElement as HTMLElement);
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				els[(cur + 1) % els.length]?.focus();
				break;
			case 'ArrowUp':
				e.preventDefault();
				els[(cur - 1 + els.length) % els.length]?.focus();
				break;
			case 'Home':
				e.preventDefault();
				els[0]?.focus();
				break;
			case 'End':
				e.preventDefault();
				els[els.length - 1]?.focus();
				break;
			case 'Escape':
				// Consume so a wrapping Dialog Esc handler doesn't also fire.
				e.preventDefault();
				e.stopPropagation();
				closeMenu(true);
				break;
			case 'Tab':
				// Remove the panel synchronously, refocus the trigger, and let the
				// un-prevented Tab advance from there per the tab sequence.
				flushSync(() => (open = false));
				returnEl?.focus?.();
				break;
			default:
				if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
					e.preventDefault();
					const now = Date.now();
					if (now - typedAt > 500) typed = '';
					typedAt = now;
					typed += e.key.toLowerCase();
					const from = typed.length === 1 ? (cur + 1) % items.length : Math.max(cur, 0);
					for (let k = 0; k < items.length; k++) {
						const i = (from + k) % items.length;
						if (items[i].label.toLowerCase().startsWith(typed)) {
							els[i]?.focus();
							break;
						}
					}
				}
		}
	}

	// Flip/collision — same hand-rolled pass as Popover.
	$effect(() => {
		if (!open || !panel || !wrapper) {
			flipped = false;
			shift = 0;
			return;
		}
		const r = panel.getBoundingClientRect();
		const anchor = wrapper.getBoundingClientRect();
		const startsTop = placement.startsWith('top');
		if (!startsTop && r.bottom > window.innerHeight - 8 && anchor.top - r.height - 8 > 0) {
			flipped = true;
		} else if (startsTop && r.top < 8 && anchor.bottom + r.height + 8 < window.innerHeight) {
			flipped = true;
		}
		let s = 0;
		if (r.left < 8) s = 8 - r.left;
		else if (r.right > window.innerWidth - 8) s = window.innerWidth - 8 - r.right;
		shift = s;
	});

	const itemClass = (danger?: boolean) =>
		cn(
			'flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] focus:outline-none',
			danger
				? 'text-red-600 hover:bg-red-500/10 focus:bg-red-500/10 dark:text-red-400'
				: 'text-neutral-700 hover:bg-neutral-100 focus:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800'
		);
</script>

<div
	bind:this={wrapper}
	role="presentation"
	class="relative inline-block"
	use:clickOutside={() => open && closeMenu(false)}
>
	{@render trigger({
		'aria-haspopup': 'menu',
		'aria-expanded': open,
		'aria-controls': open ? menuId : undefined,
		onclick: () => (open ? closeMenu(true) : openMenu(0)),
		onkeydown: onTriggerKeydown
	})}

	{#if open}
		<div
			bind:this={panel}
			id={menuId}
			role="menu"
			aria-label={ariaLabel}
			tabindex="-1"
			onkeydown={onMenuKeydown}
			style:translate={shift !== 0 ? `${shift}px 0` : undefined}
			class={cn(
				'ot-menu-panel absolute z-40 min-w-[180px] max-w-[280px] rounded-lg border border-neutral-200 bg-white p-1 shadow-lg focus:outline-none dark:border-neutral-800 dark:bg-neutral-900',
				above ? 'bottom-full mb-1' : 'top-full mt-1',
				alignEnd ? 'right-0' : 'left-0',
				klass
			)}
		>
			{#each items as item, i (`${item.label}-${i}`)}
				{@const Icon = item.icon}
				{@const keys = item.kbd == null ? null : Array.isArray(item.kbd) ? item.kbd : [item.kbd]}
				{#if item.href}
					<a
						role="menuitem"
						tabindex="-1"
						href={item.href}
						onclick={() => closeMenu(false)}
						onmouseenter={(e) => e.currentTarget.focus()}
						class={itemClass(item.danger)}
					>
						{#if Icon}<Icon
								size={15}
								class={cn('shrink-0', !item.danger && 'text-neutral-500 dark:text-neutral-400')}
								aria-hidden="true"
							/>{/if}
						<span class="min-w-0 flex-1 truncate">{item.label}</span>
						{#if keys}<Kbd {keys} class="ml-2 shrink-0" />{/if}
					</a>
				{:else}
					<button
						type="button"
						role="menuitem"
						tabindex="-1"
						onclick={() => select(item)}
						onmouseenter={(e) => e.currentTarget.focus()}
						class={itemClass(item.danger)}
					>
						{#if Icon}<Icon
								size={15}
								class={cn('shrink-0', !item.danger && 'text-neutral-500 dark:text-neutral-400')}
								aria-hidden="true"
							/>{/if}
						<span class="min-w-0 flex-1 truncate">{item.label}</span>
						{#if keys}<Kbd {keys} class="ml-2 shrink-0" />{/if}
					</button>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.ot-menu-panel {
		animation: ot-menu-in 120ms var(--ease-out-quint);
	}
	@keyframes ot-menu-in {
		from {
			opacity: 0;
			transform: scale(0.98);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ot-menu-panel {
			animation: none;
		}
	}
</style>
