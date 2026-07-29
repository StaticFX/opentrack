<!--
	BootField — the full-viewport cinematic backdrop for the hero: a
	blueprint grid, a cursor-reactive cobalt dot field (vendored DotField),
	slow concentric "power-on" rings breathing out from the card, and a
	center vignette so the floating auth card keeps contrast over the
	texture. Everything here is aria-hidden decoration; DotField already
	handles its own reduced-motion + tab-hidden guards, and the rings below
	are hidden entirely under prefers-reduced-motion for a calm, static card.
-->
<script lang="ts">
	import DotField from '$lib/components/vendor/DotField.svelte';

	let { class: className = '' }: { class?: string } = $props();
</script>

<div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden {className}" aria-hidden="true">
	<!-- blueprint graph-paper, two-layer -->
	<svg class="absolute inset-0 h-full w-full opacity-70" focusable="false">
		<defs>
			<pattern id="ab-grid-minor" width="26" height="26" patternUnits="userSpaceOnUse">
				<path d="M 26 0 L 0 0 0 26" fill="none" stroke="var(--accent)" stroke-opacity="0.05" stroke-width="1" />
			</pattern>
			<pattern id="ab-grid-major" width="130" height="130" patternUnits="userSpaceOnUse">
				<rect width="130" height="130" fill="url(#ab-grid-minor)" />
				<path d="M 130 0 L 0 0 0 130" fill="none" stroke="var(--accent)" stroke-opacity="0.1" stroke-width="1" />
			</pattern>
		</defs>
		<rect width="100%" height="100%" fill="url(#ab-grid-major)" />
	</svg>

	<div class="absolute inset-0">
		<DotField
			dotRadius={1.5}
			dotSpacing={24}
			cursorRadius={280}
			bulgeStrength={22}
			glowColor="oklch(0.6 0.19 262 / 0.32)"
			gradientFrom="oklch(0.62 0.19 262 / 0.32)"
			gradientTo="oklch(0.5 0.17 268 / 0.1)"
		/>
	</div>

	<!-- power-on rings, centered on the card -->
	<div class="boot-rings absolute top-1/2 left-1/2">
		<span class="ring" style="--rd:0s"></span>
		<span class="ring" style="--rd:1.6s"></span>
		<span class="ring" style="--rd:3.2s"></span>
	</div>

	<!-- vignette: keeps the card readable over the grid + dots -->
	<div
		class="absolute inset-0"
		style="background: radial-gradient(46% 42% at 50% 52%, var(--ab-bg) 0%, transparent 70%);"
	></div>
	<div
		class="absolute inset-0"
		style="background: radial-gradient(120% 90% at 50% -10%, oklch(0.63 0.18 262 / 0.16), transparent 60%), linear-gradient(180deg, transparent 60%, var(--ab-bg) 100%);"
	></div>
</div>

<style>
	.boot-rings {
		width: 1px;
		height: 1px;
	}
	.ring {
		position: absolute;
		top: 0;
		left: 0;
		width: 120px;
		height: 120px;
		margin: -60px 0 0 -60px;
		border-radius: 999px;
		border: 1px solid color-mix(in oklab, var(--accent) 55%, transparent);
		opacity: 0;
		animation: boot-ping 4.8s var(--ease-out-quint) infinite;
		animation-delay: var(--rd, 0s);
	}
	@keyframes boot-ping {
		0% {
			transform: scale(1);
			opacity: 0.4;
		}
		70% {
			opacity: 0;
		}
		100% {
			transform: scale(9);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ring {
			animation: none;
			opacity: 0;
		}
	}
</style>
