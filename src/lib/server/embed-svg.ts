import type { RoadmapLane } from '$lib/roadmap';

/** XML-escape text for safe inclusion in SVG. */
function esc(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
function clip(s: string, n: number): string {
	return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// A neutral card that reads on both light and dark READMEs.
const BG = '#ffffff';
const BORDER = '#e5e7eb';
const FG = '#111827';
const MUTED = '#6b7280';
const ACCENT = '#4f46e5';

function shell(width: number, height: number, inner: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="${BG}" stroke="${BORDER}"/>
${inner}
<text x="${width - 14}" y="${height - 12}" text-anchor="end" font-size="10" fill="${MUTED}">Powered by OpenTrack</text>
</svg>`;
}

/** Render the public roadmap (Planned / In Progress / Shipped) as an SVG card. */
export function roadmapSvg(projectName: string, lanes: RoadmapLane[]): string {
	const W = 720;
	const colW = 224;
	const perLane = 6;
	const rowH = 22;
	const bodyTop = 78;
	const rows = Math.max(1, ...lanes.map((l) => Math.min(l.items.length, perLane)));
	const H = bodyTop + rows * rowH + 34;

	let out = `<text x="20" y="30" font-size="17" font-weight="700" fill="${FG}">${esc(clip(projectName, 44))}</text>`;
	out += `<text x="20" y="50" font-size="12" fill="${MUTED}">Roadmap</text>`;
	out += `<line x1="20" y1="62" x2="${W - 20}" y2="62" stroke="${BORDER}"/>`;

	lanes.forEach((lane, i) => {
		const x = 20 + i * (colW + 12);
		out += `<text x="${x}" y="${bodyTop - 4}" font-size="12" font-weight="600" fill="${FG}">${esc(lane.title)}</text>`;
		out += `<text x="${x + colW - 8}" y="${bodyTop - 4}" text-anchor="end" font-size="12" font-weight="700" fill="${ACCENT}">${lane.count}</text>`;
		lane.items.slice(0, perLane).forEach((it, r) => {
			const y = bodyTop + 18 + r * rowH;
			out += `<text x="${x}" y="${y}" font-size="11" fill="${MUTED}">#${it.number}</text>`;
			out += `<text x="${x + 30}" y="${y}" font-size="11" fill="${FG}">${esc(clip(it.title, 24))}</text>`;
		});
		if (lane.items.length === 0) {
			out += `<text x="${x}" y="${bodyTop + 18}" font-size="11" fill="${MUTED}">—</text>`;
		}
	});
	return shell(W, H, out);
}

/** Render the published changelog (recent releases) as an SVG card. */
export function changelogSvg(
	projectName: string,
	releases: Array<{ version: string; name: string | null; releasedAt: Date | string | null }>
): string {
	const W = 460;
	const rowH = 26;
	const bodyTop = 74;
	const shown = releases.slice(0, 8);
	const H = bodyTop + Math.max(1, shown.length) * rowH + 30;

	let out = `<text x="20" y="30" font-size="17" font-weight="700" fill="${FG}">${esc(clip(projectName, 30))}</text>`;
	out += `<text x="20" y="50" font-size="12" fill="${MUTED}">Changelog</text>`;
	out += `<line x1="20" y1="62" x2="${W - 20}" y2="62" stroke="${BORDER}"/>`;

	shown.forEach((r, i) => {
		const y = bodyTop + 12 + i * rowH;
		const date = r.releasedAt ? new Date(r.releasedAt).toISOString().slice(0, 10) : '';
		out += `<text x="20" y="${y}" font-size="13" font-weight="600" fill="${ACCENT}">${esc(clip(r.version, 18))}</text>`;
		if (r.name) out += `<text x="130" y="${y}" font-size="12" fill="${FG}">${esc(clip(r.name, 28))}</text>`;
		out += `<text x="${W - 20}" y="${y}" text-anchor="end" font-size="11" fill="${MUTED}">${esc(date)}</text>`;
	});
	if (shown.length === 0) out += `<text x="20" y="${bodyTop + 12}" font-size="12" fill="${MUTED}">No releases yet.</text>`;
	return shell(W, H, out);
}

/** Standard SVG HTTP response (cacheable, fram-agnostic). */
export function svgResponse(svg: string): Response {
	return new Response(svg, {
		headers: {
			'content-type': 'image/svg+xml; charset=utf-8',
			'cache-control': 'public, max-age=300'
		}
	});
}
