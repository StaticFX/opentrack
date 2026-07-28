/** Catmull-Rom → cubic-bezier smoothing shared by Heartbeat and Sparkline. */
export function smoothPath(pts: Array<{ x: number; y: number }>): string {
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

/** Map a numeric series into smoothed line + closed area paths for a small viewBox. */
export function sparkPaths(
	values: number[],
	w: number,
	h: number,
	pad = 2
): { line: string; area: string } {
	if (values.length < 2) return { line: '', area: '' };
	const max = Math.max(1, ...values);
	const pts = values.map((v, i) => ({
		x: pad + (i * (w - 2 * pad)) / (values.length - 1),
		y: h - pad - (v / max) * (h - 2 * pad)
	}));
	const line = smoothPath(pts);
	const area = line
		? `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${h} L ${pts[0].x.toFixed(1)} ${h} Z`
		: '';
	return { line, area };
}
