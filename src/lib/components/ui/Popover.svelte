<script lang="ts" module>
	export type PopoverPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
	/** Spread onto the trigger element inside the `trigger` snippet. */
	export type PopoverTriggerProps = {
		'aria-haspopup': 'dialog';
		'aria-expanded': boolean;
		'aria-controls': string | undefined;
		onclick: () => void;
	};
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import type { Snippet } from 'svelte';
	import { clickOutside } from '$lib/utils/clickOutside';
	import { cn } from '$lib/utils/cn';

	type Props = {
		open?: boolean;
		placement?: PopoverPlacement;
		/** Focus-trap + backdrop; use for anchored panels holding form controls. */
		modal?: boolean;
		/** Applied to the panel (width, padding). */
		class?: string;
		trigger: Snippet<[PopoverTriggerProps]>;
		content: Snippet;
	};
	let {
		open = $bindable(false),
		placement = 'bottom-start',
		modal = false,
		class: klass,
		trigger,
		content
	}: Props = $props();

	const uid = $props.id();
	const panelId = `${uid}-popover`;

	let wrapper = $state<HTMLDivElement>();
	let panel = $state<HTMLDivElement>();
	let flipped = $state(false);
	let shift = $state(0);
	let returnEl: HTMLElement | null = null;

	const above = $derived(placement.startsWith('top') !== flipped);
	const alignEnd = $derived(placement.endsWith('end'));

	const FOCUSABLE =
		'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

	function focusables(): HTMLElement[] {
		return panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
	}

	function toggle() {
		open = !open;
	}

	function close(returnFocus: boolean) {
		const hadFocus = panel?.contains(document.activeElement) ?? false;
		open = false;
		if (returnFocus || hadFocus) returnEl?.focus?.();
	}

	// Capture the focus-return anchor at open; modal panels take focus.
	$effect(() => {
		if (!open) return;
		returnEl = document.activeElement as HTMLElement | null;
		if (modal) {
			tick().then(() => {
				(focusables()[0] ?? panel)?.focus();
			});
		}
	});

	// Flip below→above when the preferred side clips the viewport; nudge
	// horizontally on collision. Writes state it never reads — no loop.
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

	function onWrapperKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			// Consume so a wrapping Dialog Esc handler doesn't also fire.
			e.preventDefault();
			e.stopPropagation();
			close(true);
			return;
		}
		if (modal && e.key === 'Tab') {
			const els = focusables();
			if (els.length === 0) {
				e.preventDefault();
				panel?.focus();
				return;
			}
			const first = els[0];
			const last = els[els.length - 1];
			const active = document.activeElement as HTMLElement | null;
			const inside = active != null && panel?.contains(active);
			if (e.shiftKey) {
				if (!inside || active === first) {
					e.preventDefault();
					last.focus();
				}
			} else if (!inside || active === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}
</script>

<!-- Fallback for mouse-only opens in browsers that don't focus clicked buttons. -->
<svelte:window
	onkeydown={(e) => {
		if (open && e.key === 'Escape' && !wrapper?.contains(document.activeElement)) close(false);
	}}
/>

<div
	bind:this={wrapper}
	role="presentation"
	class="relative inline-block"
	use:clickOutside={() => open && close(false)}
	onkeydown={onWrapperKeydown}
>
	{@render trigger({
		'aria-haspopup': 'dialog',
		'aria-expanded': open,
		'aria-controls': open ? panelId : undefined,
		onclick: toggle
	})}

	{#if open}
		{#if modal}
			<button
				type="button"
				aria-label="Close"
				tabindex="-1"
				class="fixed inset-0 z-30 cursor-default"
				onclick={() => close(false)}
			></button>
		{/if}
		<div
			bind:this={panel}
			id={panelId}
			role={modal ? 'dialog' : undefined}
			aria-modal={modal ? 'true' : undefined}
			tabindex="-1"
			style:translate={shift !== 0 ? `${shift}px 0` : undefined}
			class={cn(
				'ot-popover-panel absolute z-40 min-w-40 rounded-lg border border-neutral-200 bg-white shadow-lg focus:outline-none dark:border-neutral-800 dark:bg-neutral-900',
				above ? 'bottom-full mb-1' : 'top-full mt-1',
				alignEnd ? 'right-0' : 'left-0',
				klass
			)}
		>
			{@render content()}
		</div>
	{/if}
</div>

<style>
	.ot-popover-panel {
		animation: ot-popover-in 120ms var(--ease-out-quint);
	}
	@keyframes ot-popover-in {
		from {
			opacity: 0;
			transform: scale(0.98);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ot-popover-panel {
			animation: none;
		}
	}
</style>
