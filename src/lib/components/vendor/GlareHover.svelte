<!--
	GlareHover — vendored from Svelte Bits (https://sveltebits.xyz, github.com/DavidHDev/svelte-bits)
	Copyright (c) 2026 David Haz — MIT + Commons Clause (used as part of this application).
	Local adaptations: the JS mouseenter/forced-reflow animation is replaced by a pure CSS
	:hover background-position transition; unstyled root (width/height/background/border props
	dropped — callers pass their own surface classes); hex→rgba parsing replaced by color-mix
	so theme tokens work (default sheen is --accent-glow); under prefers-reduced-motion the
	sheen overlay is removed entirely.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children?: Snippet;
		glareColor?: string;
		glareOpacity?: number;
		glareAngle?: number;
		glareSize?: number;
		transitionDuration?: number;
		class?: string;
		style?: string;
	};

	let {
		children,
		glareColor = 'var(--accent-glow)',
		glareOpacity = 1,
		glareAngle = -45,
		glareSize = 250,
		transitionDuration = 650,
		class: className = '',
		style = ''
	}: Props = $props();

	const sheen = $derived(
		glareOpacity >= 1
			? glareColor
			: `color-mix(in oklab, ${glareColor} ${Math.round(glareOpacity * 100)}%, transparent)`
	);
</script>

<div
	class="glare-hover relative overflow-hidden {className}"
	style="--glare-angle:{glareAngle}deg;--glare-color:{sheen};--glare-size:{glareSize}%;--glare-duration:{transitionDuration}ms;{style}"
>
	{@render children?.()}
	<div class="glare-overlay pointer-events-none absolute inset-0" aria-hidden="true"></div>
</div>

<style>
	.glare-overlay {
		background: linear-gradient(
			var(--glare-angle),
			transparent 60%,
			var(--glare-color) 70%,
			transparent 100%
		);
		background-size: var(--glare-size) var(--glare-size);
		background-repeat: no-repeat;
		background-position: -100% -100%;
		transition: background-position var(--glare-duration) ease;
	}
	.glare-hover:hover .glare-overlay {
		background-position: 100% 100%;
	}
	@media (prefers-reduced-motion: reduce) {
		.glare-overlay {
			display: none;
		}
	}
</style>
