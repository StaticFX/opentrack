<script lang="ts" module>
	export type SheetSide = 'right' | 'bottom' | 'left';
	export type SheetSize = 'sm' | 'md' | 'full';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import { fade, fly, type FlyParams } from 'svelte/transition';
	import { expoOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { cn } from '$lib/utils/cn';

	type Props = {
		open?: boolean;
		side?: SheetSide;
		size?: SheetSize;
		/** Accessible name for the dialog (the sheet renders no chrome of its own). */
		ariaLabel?: string;
		/** Called when the sheet asks to close (Esc / backdrop). When provided the
		 * caller owns closing — history-managed surfaces call history.back() here. */
		onclose?: () => void;
		class?: string;
		children: Snippet;
	};
	let {
		open = $bindable(false),
		side = 'right',
		size = 'md',
		ariaLabel,
		onclose,
		class: klass,
		children
	}: Props = $props();

	const dur = $derived(prefersReducedMotion.current ? 0 : 200);

	let wrapper = $state<HTMLDivElement>();
	let panel = $state<HTMLDivElement>();

	function requestClose() {
		if (onclose) onclose();
		else open = false;
	}

	const flyParams: FlyParams = $derived(
		side === 'bottom'
			? { y: '100%', duration: dur, easing: expoOut, opacity: 1 }
			: { x: side === 'right' ? '100%' : '-100%', duration: dur, easing: expoOut, opacity: 1 }
	);

	const positions: Record<SheetSide, string> = {
		right: 'inset-y-0 right-0 hairline-l',
		left: 'inset-y-0 left-0 hairline-r',
		bottom: 'inset-x-0 bottom-0 rounded-t-2xl hairline-t'
	};
	const sizeCls = $derived(
		side === 'bottom'
			? { sm: 'max-h-[40vh]', md: 'max-h-[75vh]', full: 'h-dvh max-h-none rounded-none' }[size]
			: { sm: 'w-72 max-w-[85vw]', md: 'w-96 max-w-[92vw]', full: 'w-screen' }[size]
	);

	// tabindex=-1 excluded throughout: open Select popups manage their own focus.
	const FOCUSABLE =
		'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

	function focusables(): HTMLElement[] {
		return panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
	}

	// Belt to inert's braces: keeps Tab inside even where inert is unsupported.
	function trapKeydown(e: KeyboardEvent) {
		if (e.key !== 'Tab') return;
		const els = focusables();
		if (els.length === 0) {
			e.preventDefault();
			panel?.focus();
			return;
		}
		const first = els[0];
		const last = els[els.length - 1];
		const activeEl = document.activeElement as HTMLElement | null;
		const inside = activeEl != null && panel?.contains(activeEl);
		if (e.shiftKey) {
			if (!inside || activeEl === first) {
				e.preventDefault();
				last.focus();
			}
		} else if (!inside || activeEl === last) {
			e.preventDefault();
			first.focus();
		}
	}

	// Dialog semantics: inert the background (siblings of every ancestor), lock
	// the scroll of body + the nearest scrollable ancestor (the app scrolls
	// `main`), move focus in, restore on close.
	$effect(() => {
		if (!open || !wrapper) return;
		const restore = document.activeElement as HTMLElement | null;
		const inerted: Array<[HTMLElement, boolean]> = [];
		let node: HTMLElement | null = wrapper;
		while (node && node !== document.body && node.parentElement) {
			for (const sib of Array.from(node.parentElement.children)) {
				if (sib !== node && sib instanceof HTMLElement) {
					inerted.push([sib, sib.inert]);
					sib.inert = true;
				}
			}
			node = node.parentElement;
		}
		const locked: Array<[HTMLElement, string]> = [];
		const lock = (el: HTMLElement) => {
			locked.push([el, el.style.overflow]);
			el.style.overflow = 'hidden';
		};
		let anc = wrapper.parentElement;
		while (anc) {
			const oy = getComputedStyle(anc).overflowY;
			if ((oy === 'auto' || oy === 'scroll') && anc.scrollHeight > anc.clientHeight) {
				lock(anc);
				break;
			}
			anc = anc.parentElement;
		}
		lock(document.body);
		tick().then(() => {
			const els = focusables();
			const target = els.find((el) => !el.hasAttribute('data-sheet-close')) ?? els[0] ?? panel;
			target?.focus();
		});
		return () => {
			for (const [el, prev] of inerted) el.inert = prev;
			for (const [el, prev] of locked) el.style.overflow = prev;
			restore?.focus?.();
		};
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (open && e.key === 'Escape' && !e.defaultPrevented) requestClose();
	}}
/>

{#if open}
	<div bind:this={wrapper} role="presentation" class="fixed inset-0 z-50" onkeydown={trapKeydown}>
		<button
			type="button"
			aria-label="Close"
			data-sheet-close
			class="absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px]"
			onclick={requestClose}
			transition:fade={{ duration: dur }}
		></button>
		<div
			bind:this={panel}
			role="dialog"
			aria-modal="true"
			aria-label={ariaLabel}
			tabindex="-1"
			class={cn(
				'absolute overflow-y-auto bg-white shadow-2xl focus:outline-none dark:bg-neutral-900',
				positions[side],
				sizeCls,
				klass
			)}
			transition:fly={flyParams}
		>
			{@render children()}
		</div>
	</div>
{/if}
