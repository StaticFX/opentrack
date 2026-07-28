<!--
	StarBorder — vendored from Svelte Bits (https://sveltebits.xyz, github.com/DavidHDev/svelte-bits)
	Copyright (c) 2026 David Haz — MIT + Commons Clause (used as part of this application).
	Local adaptations: theme-aware default color (--accent token), the hardcoded inner pill is
	replaced by innerClass/radius props, display is caller-controlled (no forced inline-block),
	and prefers-reduced-motion swaps the sweeps for a static subtle border (CSS-only).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children?: Snippet;
		as?: string;
		class?: string;
		innerClass?: string;
		color?: string;
		speed?: string;
		thickness?: number;
		radius?: string;
		[key: string]: unknown;
	};

	let {
		children,
		as = 'button',
		class: className = '',
		innerClass = '',
		color = 'var(--accent)',
		speed = '6s',
		thickness = 1,
		radius = '1rem',
		...rest
	}: Props = $props();

	const gradientBg = $derived(`radial-gradient(circle, ${color}, transparent 10%)`);
	/* Inner corner sits inside the outer one, so it never peeks past the wrapper. */
	const innerRadius = $derived(`max(0px, calc(${radius} - ${thickness}px))`);
</script>

<svelte:element
	this={as}
	class="star-border relative overflow-hidden {className}"
	style:border-radius={radius}
	style:padding="{thickness}px"
	style:--star-border-color={color}
	{...rest}
>
	<div
		class="star-sweep-bottom absolute bottom-[-11px] right-[-250%] z-0 h-[50%] w-[300%] rounded-full opacity-70"
		style:background={gradientBg}
		style:animation-duration={speed}
	></div>
	<div
		class="star-sweep-top absolute left-[-250%] top-[-10px] z-0 h-[50%] w-[300%] rounded-full opacity-70"
		style:background={gradientBg}
		style:animation-duration={speed}
	></div>
	<div class="relative z-1 {innerClass}" style:border-radius={innerRadius}>
		{@render children?.()}
	</div>
</svelte:element>

<style>
	.star-sweep-bottom {
		animation-name: star-movement-bottom;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
		animation-direction: alternate;
	}
	.star-sweep-top {
		animation-name: star-movement-top;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
		animation-direction: alternate;
	}
	@keyframes star-movement-bottom {
		0% {
			transform: translate(0%, 0%);
			opacity: 1;
		}
		100% {
			transform: translate(-100%, 0%);
			opacity: 0;
		}
	}
	@keyframes star-movement-top {
		0% {
			transform: translate(0%, 0%);
			opacity: 1;
		}
		100% {
			transform: translate(100%, 0%);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.star-sweep-top,
		.star-sweep-bottom {
			display: none;
		}
		/* The all-round thickness gap still reads as a border: a static, subtle
		   wash of the sweep color as a hairline on every edge. */
		.star-border {
			background: color-mix(in oklab, var(--star-border-color) 40%, transparent);
		}
	}
</style>
