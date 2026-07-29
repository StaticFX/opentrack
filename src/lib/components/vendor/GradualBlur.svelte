<!--
	GradualBlur — vendored from Svelte Bits (https://sveltebits.xyz, github.com/DavidHDev/svelte-bits)
	Copyright (c) 2026 David Haz — MIT + Commons Clause (used as part of this application).
	Local adaptations: reduced to a zero-motion overlay — presets, hover/scroll animation,
	curves and page targeting dropped; props are just {side, size}. Pure CSS mask +
	backdrop-filter layers, no JS beyond string derivation, so it renders identically in SSR.
	Position the parent (relative) and this paints a soft blur fade at the given edge.
-->
<script module lang="ts">
	type Side = 'top' | 'bottom' | 'left' | 'right';

	const LAYERS = 4;
	const STRENGTH = 2;
	const DIRECTION: Record<Side, string> = {
		top: 'to top',
		bottom: 'to bottom',
		left: 'to left',
		right: 'to right'
	};

	/* Stacked backdrop-blur layers, each masked to a band that gets progressively
	   blurrier toward the edge — the same math as upstream, constants folded in. */
	function layerStyles(side: Side): string[] {
		const dir = DIRECTION[side];
		const inc = 100 / LAYERS;
		const out: string[] = [];
		for (let i = 1; i <= LAYERS; i++) {
			const blur = (0.0625 * (i + 1) * STRENGTH).toFixed(3);
			const p1 = Math.round((inc * i - inc) * 10) / 10;
			const p2 = Math.round(inc * i * 10) / 10;
			const p3 = Math.round((inc * i + inc) * 10) / 10;
			const p4 = Math.round((inc * i + inc * 2) * 10) / 10;
			let grad = `transparent ${p1}%, black ${p2}%`;
			if (p3 <= 100) grad += `, black ${p3}%`;
			if (p4 <= 100) grad += `, transparent ${p4}%`;
			const mask = `linear-gradient(${dir}, ${grad})`;
			out.push(
				`mask-image:${mask};-webkit-mask-image:${mask};` +
					`backdrop-filter:blur(${blur}rem);-webkit-backdrop-filter:blur(${blur}rem);`
			);
		}
		return out;
	}
</script>

<script lang="ts">
	type Props = {
		side: Side;
		size?: number;
		class?: string;
	};

	let { side, size = 48, class: className = '' }: Props = $props();

	const layers = $derived(layerStyles(side));

	const containerStyle = $derived.by(() => {
		if (side === 'top' || side === 'bottom') {
			return `${side}:0;left:0;right:0;height:${size}px;`;
		}
		return `${side}:0;top:0;bottom:0;width:${size}px;`;
	});
</script>

<div class="pointer-events-none absolute z-10 {className}" style={containerStyle} aria-hidden="true">
	{#each layers as style, i (i)}
		<div class="absolute inset-0" {style}></div>
	{/each}
</div>
