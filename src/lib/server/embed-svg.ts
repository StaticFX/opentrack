import type { RoadmapLane } from '$lib/roadmap';
import { LUCIDE_ICONS } from './lucide-icons';

export type EmbedTheme = 'light' | 'dark';

/** Fallback lane colors (match the HTML embed) when a column has no color. */
const LANE_COLOR: Record<string, string> = {
	planned: '#3b82f6',
	in_progress: '#f59e0b',
	shipped: '#22c55e'
};

/** Render a curated column icon as an inline lucide stroke drawing. */
function lucide(key: string | null | undefined, x: number, y: number, size: number, color: string): string {
	const els = key ? LUCIDE_ICONS[key] : undefined;
	if (!els) return `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 4}" fill="${color}"/>`;
	const s = size / 24;
	let inner = '';
	for (const [tag, a] of els) {
		if (tag === 'path') inner += `<path d="${a.d}"/>`;
		else if (tag === 'circle') inner += `<circle cx="${a.cx}" cy="${a.cy}" r="${a.r}"/>`;
		else if (tag === 'line') inner += `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}"/>`;
		else if (tag === 'polyline') inner += `<polyline points="${a.points}"/>`;
		else if (tag === 'polygon') inner += `<polygon points="${a.points}"/>`;
		else if (tag === 'rect')
			inner += `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" rx="${a.rx ?? 0}"/>`;
	}
	return `<g transform="translate(${x},${y}) scale(${s})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
}

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

// App-matched palettes (brand = indigo). Two static variants so GitHub can pick
// via a <picture> element (prefers-color-scheme) — CSS inside a proxied SVG is
// unreliable, static per-theme URLs are not.
interface Palette {
	bg: string;
	panel: string;
	border: string;
	fg: string;
	muted: string;
	accent: string;
}
const PALETTES: Record<EmbedTheme, Palette> = {
	light: { bg: '#ffffff', panel: '#fafafa', border: '#e5e5e5', fg: '#171717', muted: '#737373', accent: '#6366f1' },
	dark: { bg: '#171717', panel: '#0a0a0a', border: '#333333', fg: '#f5f5f5', muted: '#a3a3a3', accent: '#818cf8' }
};

function shell(p: Palette, width: number, height: number, inner: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="${p.bg}" stroke="${p.border}"/>
${inner}
<text x="${width - 14}" y="${height - 13}" text-anchor="end" font-size="10" fill="${p.muted}">Powered by OpenTrack</text>
</svg>`;
}

/** Render the public roadmap (Planned / In Progress / Shipped) as an SVG card. */
export function roadmapSvg(projectName: string, lanes: RoadmapLane[], theme: EmbedTheme = 'light'): string {
	const p = PALETTES[theme];
	const pad = 20;
	const gap = 16;
	const W = 960;
	const colW = (W - pad * 2 - gap * 2) / 3; // ≈ 293
	const perLane = 8;
	const rowH = 30;
	const bodyTop = 98;
	const rows = Math.max(1, ...lanes.map((l) => Math.min(l.items.length, perLane)));
	const H = bodyTop + rows * rowH + 30;

	// Header: brand dot + name + subtitle.
	let out = `<circle cx="${pad + 7}" cy="27" r="6" fill="${p.accent}"/>`;
	out += `<text x="${pad + 21}" y="32" font-size="18" font-weight="700" fill="${p.fg}">${esc(clip(projectName, 56))}</text>`;
	out += `<text x="${pad}" y="58" font-size="12" fill="${p.muted}">Roadmap</text>`;
	out += `<line x1="${pad}" y1="72" x2="${W - pad}" y2="72" stroke="${p.border}"/>`;

	lanes.forEach((lane, i) => {
		const x = pad + i * (colW + gap);
		const laneColor = lane.color || LANE_COLOR[lane.key] || p.accent;
		// Lane header: column icon + title + count.
		out += lucide(lane.icon, x, bodyTop - 34, 16, laneColor);
		out += `<text x="${x + 22}" y="${bodyTop - 21}" font-size="13" font-weight="600" fill="${p.fg}">${esc(lane.title)}</text>`;
		out += `<text x="${x + colW}" y="${bodyTop - 21}" text-anchor="end" font-size="13" font-weight="700" fill="${laneColor}">${lane.count}</text>`;

		const items = lane.items.slice(0, perLane);
		items.forEach((it, r) => {
			const cy = bodyTop - 12 + r * rowH;
			// Bordered item card, mirroring the HTML embed.
			out += `<rect x="${x}" y="${cy}" width="${colW}" height="24" rx="7" fill="${p.panel}" stroke="${p.border}"/>`;
			out += `<text x="${x + 10}" y="${cy + 16}" font-size="10" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" fill="${p.muted}">#${it.number}</text>`;
			const voteW = it.votes ? 34 : 8;
			const titleMax = Math.floor((colW - 44 - voteW) / 6.2);
			out += `<text x="${x + 40}" y="${cy + 16}" font-size="12" fill="${p.fg}">${esc(clip(it.title, titleMax))}</text>`;
			if (it.votes) out += `<text x="${x + colW - 10}" y="${cy + 16}" text-anchor="end" font-size="10" fill="${p.muted}">▲ ${it.votes}</text>`;
		});
		if (items.length === 0) {
			out += `<text x="${x + 4}" y="${bodyTop + 4}" font-size="12" fill="${p.muted}">—</text>`;
		}
	});
	return shell(p, W, H, out);
}

/** Render the published changelog (recent releases) as an SVG card. */
export function changelogSvg(
	projectName: string,
	releases: Array<{ version: string; name: string | null; releasedAt: Date | string | null }>,
	theme: EmbedTheme = 'light'
): string {
	const p = PALETTES[theme];
	const W = 460;
	const rowH = 26;
	const bodyTop = 80;
	const shown = releases.slice(0, 8);
	const H = bodyTop + Math.max(1, shown.length) * rowH + 30;

	let out = `<circle cx="27" cy="26" r="6" fill="${p.accent}"/>`;
	out += `<text x="41" y="31" font-size="17" font-weight="700" fill="${p.fg}">${esc(clip(projectName, 28))}</text>`;
	out += `<text x="20" y="56" font-size="12" fill="${p.muted}">Releases</text>`;
	out += `<line x1="20" y1="68" x2="${W - 20}" y2="68" stroke="${p.border}"/>`;

	shown.forEach((r, i) => {
		const y = bodyTop + 12 + i * rowH;
		const date = r.releasedAt ? new Date(r.releasedAt).toISOString().slice(0, 10) : '';
		out += `<text x="20" y="${y}" font-size="13" font-weight="700" fill="${p.accent}">${esc(clip(r.version, 18))}</text>`;
		if (r.name) out += `<text x="132" y="${y}" font-size="12" fill="${p.fg}">${esc(clip(r.name, 28))}</text>`;
		out += `<text x="${W - 20}" y="${y}" text-anchor="end" font-size="11" fill="${p.muted}">${esc(date)}</text>`;
	});
	if (shown.length === 0) out += `<text x="20" y="${bodyTop + 12}" font-size="12" fill="${p.muted}">No releases yet.</text>`;
	return shell(p, W, H, out);
}

/** Parse the ?theme= query param into a valid EmbedTheme (default light). */
export function themeParam(v: string | null): EmbedTheme {
	return v === 'dark' ? 'dark' : 'light';
}

/** Standard SVG HTTP response (cacheable). */
export function svgResponse(svg: string): Response {
	return new Response(svg, {
		headers: {
			'content-type': 'image/svg+xml; charset=utf-8',
			'cache-control': 'public, max-age=300'
		}
	});
}
