import type { RoadmapLane } from '$lib/roadmap';

export type EmbedTheme = 'light' | 'dark';

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
	const W = 720;
	const colW = 224;
	const perLane = 6;
	const rowH = 22;
	const bodyTop = 84;
	const rows = Math.max(1, ...lanes.map((l) => Math.min(l.items.length, perLane)));
	const H = bodyTop + rows * rowH + 34;

	// Header: brand dot + name + subtitle.
	let out = `<circle cx="27" cy="26" r="6" fill="${p.accent}"/>`;
	out += `<text x="41" y="31" font-size="17" font-weight="700" fill="${p.fg}">${esc(clip(projectName, 42))}</text>`;
	out += `<text x="20" y="56" font-size="12" fill="${p.muted}">Roadmap</text>`;
	out += `<line x1="20" y1="68" x2="${W - 20}" y2="68" stroke="${p.border}"/>`;

	lanes.forEach((lane, i) => {
		const x = 20 + i * (colW + 12);
		// Lane header chip.
		out += `<rect x="${x}" y="${bodyTop - 18}" width="${colW}" height="22" rx="6" fill="${p.panel}" stroke="${p.border}"/>`;
		out += `<text x="${x + 10}" y="${bodyTop - 3}" font-size="12" font-weight="600" fill="${p.fg}">${esc(lane.title)}</text>`;
		out += `<text x="${x + colW - 10}" y="${bodyTop - 3}" text-anchor="end" font-size="12" font-weight="700" fill="${p.accent}">${lane.count}</text>`;
		lane.items.slice(0, perLane).forEach((it, r) => {
			const y = bodyTop + 22 + r * rowH;
			out += `<text x="${x + 4}" y="${y}" font-size="11" fill="${p.muted}">#${it.number}</text>`;
			out += `<text x="${x + 34}" y="${y}" font-size="11" fill="${p.fg}">${esc(clip(it.title, 23))}</text>`;
		});
		if (lane.items.length === 0) {
			out += `<text x="${x + 4}" y="${bodyTop + 22}" font-size="11" fill="${p.muted}">—</text>`;
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
	out += `<text x="20" y="56" font-size="12" fill="${p.muted}">Changelog</text>`;
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
