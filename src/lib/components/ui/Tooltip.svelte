<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	type Side = 'top' | 'bottom' | 'left' | 'right';
	type Props = {
		label: string;
		side?: Side;
		delay?: number;
		class?: string;
		children: Snippet;
	};
	let { label, side = 'top', delay = 400, class: klass, children }: Props = $props();

	const uid = $props.id();
	const tipId = `${uid}-tip`;

	let visible = $state(false);
	let wrapper = $state<HTMLSpanElement>();
	let bubble = $state<HTMLSpanElement>();
	let flippedTo = $state<Side | null>(null);
	let shift = $state(0);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const placed = $derived(flippedTo ?? side);

	function show(immediate: boolean) {
		clearTimeout(timer);
		timer = setTimeout(() => (visible = true), immediate ? 0 : delay);
	}
	function hide() {
		clearTimeout(timer);
		visible = false;
	}

	// The bubble stays in the DOM so aria-describedby always resolves; wire it
	// to the first focusable child (or the wrapper for hover-only content).
	$effect(() => {
		if (!wrapper) return;
		const el =
			wrapper.querySelector<HTMLElement>(
				'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
			) ?? wrapper;
		el.setAttribute('aria-describedby', tipId);
		return () => el.removeAttribute('aria-describedby');
	});

	// Flip to the opposite side when clipped; nudge top/bottom bubbles that
	// clip horizontally. State is reset on hide, never read here — no loop.
	$effect(() => {
		if (!visible || !bubble) {
			flippedTo = null;
			shift = 0;
			return;
		}
		const r = bubble.getBoundingClientRect();
		if (side === 'top' && r.top < 4) flippedTo = 'bottom';
		else if (side === 'bottom' && r.bottom > window.innerHeight - 4) flippedTo = 'top';
		else if (side === 'left' && r.left < 4) flippedTo = 'right';
		else if (side === 'right' && r.right > window.innerWidth - 4) flippedTo = 'left';
		if (side === 'top' || side === 'bottom') {
			if (r.left < 4) shift = 4 - r.left;
			else if (r.right > window.innerWidth - 4) shift = window.innerWidth - 4 - r.right;
		}
	});

	const SIDES: Record<Side, string> = {
		top: 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
		bottom: 'top-full left-1/2 mt-1.5 -translate-x-1/2',
		left: 'right-full top-1/2 mr-1.5 -translate-y-1/2',
		right: 'left-full top-1/2 ml-1.5 -translate-y-1/2'
	};
</script>

<svelte:window onkeydown={(e) => visible && e.key === 'Escape' && hide()} />

<span
	bind:this={wrapper}
	role="presentation"
	class={cn('relative inline-flex max-w-full', klass)}
	onpointerenter={() => show(false)}
	onpointerleave={hide}
	onfocusin={() => show(true)}
	onfocusout={hide}
>
	{@render children()}
	<span
		bind:this={bubble}
		id={tipId}
		role="tooltip"
		style:translate={shift !== 0 ? `${shift}px 0` : undefined}
		class={cn(
			'pointer-events-none absolute z-50 w-max max-w-[240px] rounded-md bg-neutral-900 px-2 py-1 text-[11px] leading-snug font-normal text-white shadow-md transition-opacity duration-100 motion-reduce:transition-none dark:bg-neutral-100 dark:text-neutral-900',
			SIDES[placed],
			visible ? 'opacity-100' : 'invisible opacity-0'
		)}
	>
		{label}
	</span>
</span>
