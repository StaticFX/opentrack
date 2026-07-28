import type { Attachment } from 'svelte/attachments';

/**
 * Count a numeral up from 0 the first time it scrolls into view. SSR renders
 * the final value (no zero-flash for crawlers/no-JS); after the first play,
 * later value changes (live reloads) update the text without re-animating.
 */
export function countUp(value: number, durationMs = 600): Attachment {
	return (node) => {
		const el = node as HTMLElement;
		if (el.dataset.counted || matchMedia('(prefers-reduced-motion: reduce)').matches) {
			el.dataset.counted = '1';
			el.textContent = String(value);
			return;
		}
		let raf = 0;
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting)) return;
				io.disconnect();
				el.dataset.counted = '1';
				const start = performance.now();
				const ease = (t: number) => 1 - Math.pow(1 - t, 4);
				const frame = (now: number) => {
					const t = Math.min(1, (now - start) / durationMs);
					el.textContent = String(Math.round(ease(t) * value));
					if (t < 1) raf = requestAnimationFrame(frame);
				};
				el.textContent = '0';
				raf = requestAnimationFrame(frame);
			},
			{ threshold: 0.4 }
		);
		io.observe(el);
		return () => {
			io.disconnect();
			cancelAnimationFrame(raf);
		};
	};
}
