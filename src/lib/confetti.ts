/**
 * Hand-rolled confetti burst — one rAF loop, ~28 particles in the page's
 * accent + brand colours, self-terminating, no dependencies. Fired from the
 * composer's success moment. No-ops under prefers-reduced-motion.
 */
export function confettiFrom(el: HTMLElement | null): void {
	if (typeof document === 'undefined' || !el) return;
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	const rect = el.getBoundingClientRect();
	const cx = rect.left + rect.width / 2;
	const cy = rect.top + rect.height / 2;

	const styles = getComputedStyle(el);
	const accent = styles.getPropertyValue('--accent').trim() || '#4263eb';
	const colors = [accent, '#7e96f2', '#3b5bdb', '#facc15', '#e5e5e5'];

	const canvas = document.createElement('canvas');
	const dpr = Math.min(2, window.devicePixelRatio || 1);
	canvas.width = window.innerWidth * dpr;
	canvas.height = window.innerHeight * dpr;
	canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
	document.body.appendChild(canvas);
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		canvas.remove();
		return;
	}
	ctx.scale(dpr, dpr);

	const parts = Array.from({ length: 28 }, () => {
		const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
		const speed = 5 + Math.random() * 7;
		return {
			x: cx,
			y: cy,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			rot: Math.random() * Math.PI,
			vr: (Math.random() - 0.5) * 0.3,
			w: 4 + Math.random() * 4,
			h: 3 + Math.random() * 3,
			color: colors[Math.floor(Math.random() * colors.length)]
		};
	});

	const start = performance.now();
	const DURATION = 1200;
	const frame = (now: number) => {
		const t = now - start;
		ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
		if (t >= DURATION) {
			canvas.remove();
			return;
		}
		const fade = 1 - t / DURATION;
		for (const p of parts) {
			p.vy += 0.25; // gravity
			p.vx *= 0.99; // drag
			p.x += p.vx;
			p.y += p.vy;
			p.rot += p.vr;
			ctx.save();
			ctx.globalAlpha = Math.max(0, fade);
			ctx.translate(p.x, p.y);
			ctx.rotate(p.rot);
			ctx.fillStyle = p.color;
			ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
			ctx.restore();
		}
		requestAnimationFrame(frame);
	};
	requestAnimationFrame(frame);
}
