<!--
	ClickSpark — vendored from Svelte Bits (https://sveltebits.xyz, github.com/DavidHDev/svelte-bits)
	Copyright (c) 2026 David Haz — MIT + Commons Clause (used as part of this application).
	Local adaptations: the rAF loop runs only while a burst is live (no persistent loop, no
	ResizeObserver — the canvas is sized on activation, so idle cost is zero); default color is
	the --accent-solid token, resolved through the canvas' computed style so CSS vars and
	currentColor work; keyboard activation (click detail 0) sparks from the element center; the
	canvas bleeds past the wrapper so sparks aren't clipped on small buttons; DPR-aware; and
	prefers-reduced-motion makes activation a no-op.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Spark = { x: number; y: number; angle: number; start: number };

	type Props = {
		children?: Snippet;
		sparkColor?: string;
		sparkSize?: number;
		sparkRadius?: number;
		sparkCount?: number;
		duration?: number;
		extraScale?: number;
		class?: string;
	};

	let {
		children,
		sparkColor = 'var(--accent-solid)',
		sparkSize = 8,
		sparkRadius = 14,
		sparkCount = 8,
		duration = 300,
		extraScale = 1,
		class: className = ''
	}: Props = $props();

	/* Overdraw margin so sparks can travel past the wrapped element's box. */
	const PAD = 24;

	let wrapper: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	const sparks: Spark[] = [];
	let raf = 0;
	let resolvedColor = '';
	let dpr = 1;

	function draw(timestamp: number) {
		const ctx = canvas?.getContext('2d');
		if (!ctx) {
			raf = 0;
			return;
		}
		const w = canvas.width / dpr;
		const h = canvas.height / dpr;
		ctx.clearRect(0, 0, w, h);
		for (let i = sparks.length - 1; i >= 0; i--) {
			const spark = sparks[i];
			const elapsed = timestamp - spark.start;
			if (elapsed >= duration) {
				sparks.splice(i, 1);
				continue;
			}
			const t = elapsed / duration;
			const eased = t * (2 - t); // ease-out
			const distance = eased * sparkRadius * extraScale;
			const lineLength = sparkSize * (1 - eased);
			ctx.strokeStyle = resolvedColor;
			ctx.lineWidth = 2;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(
				spark.x + distance * Math.cos(spark.angle),
				spark.y + distance * Math.sin(spark.angle)
			);
			ctx.lineTo(
				spark.x + (distance + lineLength) * Math.cos(spark.angle),
				spark.y + (distance + lineLength) * Math.sin(spark.angle)
			);
			ctx.stroke();
		}
		if (sparks.length === 0) {
			raf = 0;
			return;
		}
		raf = requestAnimationFrame(draw);
	}

	function burst(e: MouseEvent) {
		if (!canvas || !wrapper) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const rect = wrapper.getBoundingClientRect();
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		const w = Math.ceil(rect.width) + PAD * 2;
		const h = Math.ceil(rect.height) + PAD * 2;
		if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
			canvas.width = w * dpr;
			canvas.height = h * dpr;
		}
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		const keyboard = e.detail === 0;
		const x = (keyboard ? rect.width / 2 : e.clientX - rect.left) + PAD;
		const y = (keyboard ? rect.height / 2 : e.clientY - rect.top) + PAD;
		resolvedColor = getComputedStyle(canvas).color;

		const now = performance.now();
		for (let i = 0; i < sparkCount; i++) {
			sparks.push({ x, y, angle: (2 * Math.PI * i) / sparkCount, start: now });
		}
		if (!raf) raf = requestAnimationFrame(draw);
	}

	$effect(() => {
		const el = wrapper;
		if (!el) return;
		el.addEventListener('click', burst);
		return () => {
			el.removeEventListener('click', burst);
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
			sparks.length = 0;
		};
	});
</script>

<div bind:this={wrapper} class="relative {className}">
	{@render children?.()}
	<canvas
		bind:this={canvas}
		class="pointer-events-none absolute z-10"
		style="inset:-{PAD}px;color:{sparkColor};"
		aria-hidden="true"
	></canvas>
</div>
