<script lang="ts">
	// The project's EKG: weekly opened+closed activity as a smoothed area+line,
	// SSR-rendered (zero JS), drawn on via CSS, with a breathing live dot at the
	// tip. `beat` increments on live SSE events → one-shot ping ring.
	type Pt = { label: string; opened: number; closed: number };
	type Props = { weekly: Pt[]; beat?: number };
	let { weekly, beat = 0 }: Props = $props();

	const W = 300;
	const H = 84;
	const PAD = 8;

	function smoothPath(pts: Array<{ x: number; y: number }>): string {
		if (pts.length < 2) return '';
		let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
		for (let i = 0; i < pts.length - 1; i++) {
			const p0 = pts[i - 1] ?? pts[i];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 = pts[i + 2] ?? p2;
			const c1x = p1.x + (p2.x - p0.x) / 6;
			const c1y = p1.y + (p2.y - p0.y) / 6;
			const c2x = p2.x - (p3.x - p1.x) / 6;
			const c2y = p2.y - (p3.y - p1.y) / 6;
			d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
		}
		return d;
	}

	const values = $derived(weekly.map((w) => w.opened + w.closed));
	const max = $derived(Math.max(1, ...values));
	const pts = $derived(
		values.map((v, i) => ({
			x: PAD + (i * (W - 2 * PAD)) / Math.max(1, values.length - 1),
			y: H - PAD - (v / max) * (H - 2 * PAD)
		}))
	);
	const line = $derived(smoothPath(pts));
	const area = $derived(
		line && pts.length ? `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z` : ''
	);
	const tip = $derived(pts.at(-1));
	const total = $derived(values.reduce((a, b) => a + b, 0));
	// Inline animation styles bypass the reduced-motion CSS block — gate in JS.
	// (`beat` only ever increments client-side, so SSR never renders the ping.)
	const motionOK = $derived(
		typeof matchMedia !== 'undefined' && !matchMedia('(prefers-reduced-motion: reduce)').matches
	);
</script>

<figure aria-label={`Activity over the last ${weekly.length} weeks: ${total} events`}>
	<svg viewBox={`0 0 ${W} ${H}`} class="h-auto w-full" role="img" aria-hidden="true">
		{#if area}
			<path d={area} fill="var(--accent-soft)" />
		{/if}
		{#if line}
			<path
				d={line}
				pathLength="1"
				class="ot-draw"
				stroke="var(--accent)"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				fill="none"
				vector-effect="non-scaling-stroke"
			/>
		{/if}
		{#if tip}
			<circle cx={tip.x} cy={tip.y} r="3.5" fill="var(--accent)" />
			<circle cx={tip.x} cy={tip.y} r="3.5" fill="var(--accent)" class="ot-breathe" />
			{#key beat}
				{#if beat > 0 && motionOK}
					<circle
						cx={tip.x}
						cy={tip.y}
						r="3.5"
						fill="var(--accent)"
						style="animation: ot-breathe 0.9s var(--ease-out-quint) both"
					/>
				{/if}
			{/key}
		{/if}
	</svg>
</figure>
