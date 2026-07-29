<script lang="ts">
	// Tiny inline activity trace for directory rows. Static, SSR-rendered.
	// Shared with the internal app (app/StatTile); the SVG attributes carry the
	// app's own accent, and a scoped .ot-mono override recolours it to the flat
	// cobalt line + faint fill on mono public pages (no gradient, no soft fill).
	import { sparkPaths } from '$lib/spark';

	type Props = { values: number[]; width?: number; height?: number };
	let { values, width = 96, height = 24 }: Props = $props();

	const paths = $derived(sparkPaths(values, width, height));
	const flat = $derived(values.every((v) => v === 0));
</script>

{#if !flat && paths.line}
	<svg viewBox={`0 0 ${width} ${height}`} style={`width:${width}px;height:${height}px`} aria-hidden="true">
		<path class="spark-area" d={paths.area} fill="var(--accent-soft)" />
		<path
			class="spark-line"
			d={paths.line}
			stroke="var(--accent-solid)"
			stroke-width="1.5"
			stroke-linecap="round"
			fill="none"
			vector-effect="non-scaling-stroke"
		/>
	</svg>
{:else}
	<svg viewBox={`0 0 ${width} ${height}`} style={`width:${width}px;height:${height}px`} aria-hidden="true">
		<line x1="2" y1={height - 3} x2={width - 2} y2={height - 3} stroke="currentColor" stroke-opacity="0.15" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="1 4" />
	</svg>
{/if}

<style>
	/* Flat mono recolour inside the public mono scope only — the app usage keeps
	   its presentation-attribute colours. */
	:global(.ot-mono) .spark-area {
		fill: color-mix(in srgb, var(--accent) 15%, transparent);
	}
	:global(.ot-mono) .spark-line {
		stroke: var(--accent);
	}
</style>
