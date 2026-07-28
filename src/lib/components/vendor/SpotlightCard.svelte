<!--
	SpotlightCard — vendored from Svelte Bits (https://sveltebits.xyz, github.com/DavidHDev/svelte-bits)
	Copyright (c) 2026 David Haz — MIT + Commons Clause (used as part of this application).
	Local adaptations: unstyled root (callers pass their own surface classes) + style passthrough,
	spotlight defaults to the --accent-soft token, keyboard focus centers the spotlight, the overlay
	paints below content (isolate + -z-10), and under prefers-reduced-motion the overlay and its
	listeners are skipped entirely.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		class?: string;
		style?: string;
		spotlightColor?: string;
		children?: Snippet;
	};

	let {
		class: className = '',
		style = undefined,
		spotlightColor = 'var(--accent-soft)',
		children
	}: Props = $props();

	let divRef: HTMLDivElement;
	let enabled = $state(false);
	let isFocused = $state(false);
	let posX = $state(0);
	let posY = $state(0);
	let opacity = $state(0);

	$effect(() => {
		enabled = !matchMedia('(prefers-reduced-motion: reduce)').matches;
	});

	function handleMouseMove(e: MouseEvent) {
		if (!divRef || isFocused) return;
		const rect = divRef.getBoundingClientRect();
		posX = e.clientX - rect.left;
		posY = e.clientY - rect.top;
	}
	function handleFocusIn() {
		isFocused = true;
		if (divRef) {
			const rect = divRef.getBoundingClientRect();
			posX = rect.width / 2;
			posY = rect.height / 2;
		}
		opacity = 0.6;
	}
	function handleFocusOut(e: FocusEvent) {
		if (divRef && e.relatedTarget instanceof Node && divRef.contains(e.relatedTarget)) return;
		isFocused = false;
		opacity = 0;
	}
	function handleMouseEnter() {
		opacity = 0.6;
	}
	function handleMouseLeave() {
		if (!isFocused) opacity = 0;
	}
</script>

<div
	bind:this={divRef}
	role="presentation"
	onmousemove={enabled ? handleMouseMove : undefined}
	onfocusin={enabled ? handleFocusIn : undefined}
	onfocusout={enabled ? handleFocusOut : undefined}
	onmouseenter={enabled ? handleMouseEnter : undefined}
	onmouseleave={enabled ? handleMouseLeave : undefined}
	class="relative isolate overflow-hidden {className}"
	{style}
>
	{#if enabled}
		<div
			class="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-500 ease-in-out"
			style="opacity:{opacity};background:radial-gradient(circle at {posX}px {posY}px, {spotlightColor}, transparent 80%);"
			aria-hidden="true"
		></div>
	{/if}
	{@render children?.()}
</div>
