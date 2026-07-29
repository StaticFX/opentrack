<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { X } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';

	type Props = {
		open?: boolean;
		title: string;
		description?: string;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		align?: 'center' | 'top';
		children?: Snippet;
		footer?: Snippet;
	};
	let {
		open = $bindable(false),
		title,
		description,
		size = 'md',
		align = 'center',
		children,
		footer
	}: Props = $props();

	const uid = $props.id();
	const sizes: Record<NonNullable<Props['size']>, string> = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-lg',
		xl: 'max-w-xl'
	};

	let wrapper = $state<HTMLDivElement | undefined>();
	let panel = $state<HTMLDivElement | undefined>();

	const dur = $derived(prefersReducedMotion.current ? 0 : 150);

	function close() {
		open = false;
	}

	// tabindex=-1 excluded throughout: open Select popups manage their own focus.
	const FOCUSABLE =
		'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

	function focusables(): HTMLElement[] {
		return panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
	}

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

	// Focus trap entry/restore + scroll lock. Locks body AND the nearest
	// scrollable ancestor (the app scrolls `main`, not body).
	$effect(() => {
		if (!open) return;
		const restore = document.activeElement as HTMLElement | null;
		const locked: Array<[HTMLElement, string]> = [];
		const lock = (el: HTMLElement) => {
			locked.push([el, el.style.overflow]);
			el.style.overflow = 'hidden';
		};
		let node = wrapper?.parentElement ?? null;
		while (node) {
			const oy = getComputedStyle(node).overflowY;
			if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
				lock(node);
				break;
			}
			node = node.parentElement;
		}
		lock(document.body);
		tick().then(() => {
			const els = focusables();
			const target = els.find((el) => !el.hasAttribute('data-dialog-close')) ?? els[0] ?? panel;
			target?.focus();
		});
		return () => {
			for (const [el, prev] of locked) el.style.overflow = prev;
			restore?.focus?.();
		};
	});
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && close()} />

{#if open}
	<div
		bind:this={wrapper}
		role="presentation"
		class={cn(
			'fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain p-4',
			align === 'top' ? 'items-start pt-16' : 'items-center'
		)}
		onkeydown={trapKeydown}
	>
		<button
			type="button"
			aria-label="Close dialog"
			data-dialog-close
			class="fixed inset-0 bg-neutral-950/40 backdrop-blur-[2px]"
			onclick={close}
			transition:fade={{ duration: dur }}
		></button>
		<div
			bind:this={panel}
			role="dialog"
			aria-modal="true"
			aria-labelledby={`${uid}-title`}
			aria-describedby={description ? `${uid}-desc` : undefined}
			tabindex="-1"
			class={cn(
				'relative z-10 flex max-h-full w-full flex-col rounded-xl border border-neutral-200 bg-white shadow-2xl focus:outline-none dark:border-neutral-800 dark:bg-neutral-900',
				sizes[size]
			)}
			transition:scale={{ duration: dur, start: 0.98, easing: quintOut }}
		>
			<div class="flex shrink-0 items-start justify-between gap-4 px-5 pt-4">
				<div>
					<h2 id={`${uid}-title`} class="text-base font-semibold text-neutral-900 dark:text-neutral-100">
						{title}
					</h2>
					{#if description}
						<p id={`${uid}-desc`} class="mt-0.5 text-sm text-neutral-500">{description}</p>
					{/if}
				</div>
				<button
					type="button"
					onclick={close}
					data-dialog-close
					class="focus-ring hit -mr-1 rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
					aria-label="Close"
				>
					<X size={16} />
				</button>
			</div>
			{#if children}
				<div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
					{@render children()}
				</div>
			{:else}
				<div class="pb-2"></div>
			{/if}
			{#if footer}
				<div class="hairline-t flex shrink-0 justify-end gap-2 px-5 py-3">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
