// Per-project embed configuration. Stored on `projects.embedConfig` (JSON) and
// read by the /embed/* routes, which render exactly what's configured here —
// the settings snippet needs no query params.

export type EmbedTheme = 'auto' | 'light' | 'dark';

export interface WidgetConfig {
	enabled: boolean;
	theme: EmbedTheme;
	/** null → fall back to the project's accent colour. */
	accent: string | null;
	showHeader: boolean;
	showFooter: boolean;
	/** Max items to show. */
	limit: number;
}

export interface RoadmapWidgetConfig extends WidgetConfig {
	/** Roadmap lane keys to include. */
	lanes: string[];
}

export type BadgeMetric = 'release' | 'shipped';

export interface BadgeConfig {
	enabled: boolean;
	theme: EmbedTheme;
	/** `release` → latest version; `shipped` → count of shipped items. */
	metric: BadgeMetric;
	/** Left-hand label; empty falls back to a per-metric default. */
	label: string;
}

export interface ProjectEmbedConfig {
	roadmap: RoadmapWidgetConfig;
	changelog: WidgetConfig;
	feedback: WidgetConfig;
	knownIssues: WidgetConfig;
	badge: BadgeConfig;
}

export const ROADMAP_LANE_KEYS = ['planned', 'in_progress', 'shipped'] as const;

export const ROADMAP_LANE_LABELS: Record<string, string> = {
	planned: 'Planned',
	in_progress: 'In progress',
	shipped: 'Shipped'
};

export const BADGE_METRIC_LABELS: Record<BadgeMetric, string> = {
	release: 'release',
	shipped: 'shipped'
};

const baseWidget: WidgetConfig = {
	enabled: true,
	theme: 'auto',
	accent: null,
	showHeader: true,
	showFooter: true,
	limit: 8
};

export const DEFAULT_EMBED_CONFIG: ProjectEmbedConfig = {
	roadmap: { ...baseWidget, lanes: [...ROADMAP_LANE_KEYS] },
	changelog: { ...baseWidget },
	// The new widgets ship disabled so nothing appears publicly until opted in.
	feedback: { ...baseWidget, enabled: false },
	knownIssues: { ...baseWidget, enabled: false },
	badge: { enabled: false, theme: 'auto', metric: 'release', label: '' }
};

/** Fill a stored (possibly partial/null) config with defaults so callers get a complete object. */
export function resolveEmbedConfig(
	stored: Partial<ProjectEmbedConfig> | null | undefined
): ProjectEmbedConfig {
	const d = DEFAULT_EMBED_CONFIG;
	if (!stored) return structuredClone(d);
	return {
		roadmap: { ...d.roadmap, ...stored.roadmap, lanes: stored.roadmap?.lanes ?? d.roadmap.lanes },
		changelog: { ...d.changelog, ...stored.changelog },
		feedback: { ...d.feedback, ...stored.feedback },
		knownIssues: { ...d.knownIssues, ...stored.knownIssues },
		badge: { ...d.badge, ...stored.badge }
	};
}

// ── Widget catalogue (drives the settings tab + snippet builders) ───────────

export type IframeWidgetKey = 'roadmap' | 'changelog' | 'feedback' | 'knownIssues';

export interface EmbedWidgetMeta {
	key: IframeWidgetKey;
	label: string;
	/** URL path segment under /embed/<ws>/<proj>/. */
	path: string;
	/** SVG variant path, when the widget offers one for READMEs. */
	svg?: string;
	/** Deep-link to the equivalent public page (for the "Open ↗" link). */
	publicPath: string;
	height: number;
	description: string;
	hasLanes?: boolean;
}

export const EMBED_WIDGETS: EmbedWidgetMeta[] = [
	{ key: 'roadmap', label: 'Roadmap', path: 'roadmap', svg: 'roadmap.svg', publicPath: 'roadmap', height: 340, description: 'Planned / in-progress / shipped lanes.', hasLanes: true },
	{ key: 'changelog', label: 'Changelog', path: 'changelog', svg: 'changelog.svg', publicPath: 'releases', height: 320, description: 'Your latest published releases.' },
	{ key: 'feedback', label: 'Feedback board', path: 'feedback', publicPath: 'suggestions', height: 360, description: 'Top suggestions & bugs with vote counts.' },
	{ key: 'knownIssues', label: 'Known issues', path: 'known-issues', publicPath: 'suggestions', height: 320, description: 'Open, unresolved bug reports.' }
];

// ── Snippet builders ────────────────────────────────────────────────────────

export function iframeSnippet(
	origin: string,
	ws: string,
	proj: string,
	w: EmbedWidgetMeta,
	projectName: string
): string {
	const src = `${origin}/embed/${ws}/${proj}/${w.path}`;
	return `<iframe src="${src}" width="100%" height="${w.height}" style="border:1px solid #e5e7eb;border-radius:12px" title="${projectName} ${w.label}" loading="lazy"></iframe>`;
}

export function pictureSnippet(
	origin: string,
	ws: string,
	proj: string,
	w: EmbedWidgetMeta,
	projectName: string
): string {
	const base = `${origin}/embed/${ws}/${proj}/${w.svg}`;
	const link = `${origin}/${ws}/${proj}/${w.publicPath}`;
	return `<a href="${link}">\n  <picture>\n    <source media="(prefers-color-scheme: dark)" srcset="${base}?theme=dark">\n    <img alt="${projectName} ${w.label}" src="${base}">\n  </picture>\n</a>`;
}

export function badgeSnippet(origin: string, ws: string, proj: string, projectName: string): string {
	const base = `${origin}/embed/${ws}/${proj}/badge.svg`;
	const link = `${origin}/${ws}/${proj}`;
	return `<a href="${link}">\n  <picture>\n    <source media="(prefers-color-scheme: dark)" srcset="${base}?theme=dark">\n    <img alt="${projectName}" src="${base}">\n  </picture>\n</a>`;
}
