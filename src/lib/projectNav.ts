import {
	LayoutDashboard,
	Milestone,
	Tag,
	ChartColumn,
	Activity,
	Filter,
	MessagesSquare,
	Settings
} from '@lucide/svelte';

/** A single project navigation destination (client-safe, shared by the sidebar). */
export interface ProjectNavItem {
	key: string;
	label: string;
	icon: typeof LayoutDashboard;
	href: (ws: string, proj: string) => string;
	/** Only shown to project managers. */
	manageOnly?: boolean;
	/** Lives in the public route space (opens the public site). */
	external?: boolean;
	/** Active only on an exact path match (else prefix match). */
	exact?: boolean;
}

/**
 * The canonical project sub-navigation. Boards are rendered separately (they
 * expand into the project's board list), so they are not in this array.
 */
export const PROJECT_NAV: ProjectNavItem[] = [
	{ key: 'overview', label: 'Overview', icon: LayoutDashboard, href: (w, p) => `/w/${w}/p/${p}`, exact: true },
	{ key: 'milestones', label: 'Milestones', icon: Milestone, href: (w, p) => `/w/${w}/p/${p}/milestones` },
	{ key: 'releases', label: 'Releases', icon: Tag, href: (w, p) => `/w/${w}/p/${p}/releases`, manageOnly: true },
	{ key: 'analytics', label: 'Analytics', icon: ChartColumn, href: (w, p) => `/w/${w}/p/${p}/analytics` },
	{ key: 'activity', label: 'Activity', icon: Activity, href: (w, p) => `/w/${w}/p/${p}/activity` },
	{ key: 'inbox', label: 'Triage', icon: Filter, href: (w, p) => `/w/${w}/p/${p}/inbox`, manageOnly: true },
	{ key: 'suggestions', label: 'Feedback', icon: MessagesSquare, href: (w, p) => `/${w}/${p}/suggestions`, external: true },
	{ key: 'settings', label: 'Settings', icon: Settings, href: (w, p) => `/w/${w}/p/${p}/settings`, manageOnly: true }
];

/** Whether a nav item is the active destination for the current path. */
export function isProjectNavActive(item: ProjectNavItem, path: string, ws: string, proj: string): boolean {
	const href = item.href(ws, proj);
	return item.exact ? path === href : path.startsWith(href);
}

/**
 * Path+query-aware active predicate for the rail (additive companion to
 * `isProjectNavActive`, which keeps its semantics for existing callers).
 * Board rows are rendered from `boards[]`, not PROJECT_NAV, so they pass a
 * synthetic `{ key: 'board:<id>' }` item. A board row stays lit across its
 * deep links — `/b/[id]` child routes and the `?ticket=`/`&full=1` peek (same
 * pathname, query only) — while section items go quiet in board context.
 */
export function activeMatch(
	item: Pick<ProjectNavItem, 'key'> & Partial<ProjectNavItem>,
	path: string,
	search: string,
	ws: string,
	proj: string,
	boards: Array<{ id: string }> = []
): boolean {
	if (item.external) return false;
	const base = `/w/${ws}/p/${proj}`;
	if (item.key.startsWith('board:')) {
		const id = item.key.slice('board:'.length);
		if (!boards.some((b) => b.id === id)) return false;
		const href = `${base}/b/${id}`;
		// `?ticket=` peeks keep the pathname on the board, so this also covers them.
		return path === href || path.startsWith(`${href}/`) || (path === href && search.length > 0);
	}
	// Board context (incl. /t/[n] deep links that redirect onto a board) belongs
	// to board rows — no section item lights up.
	if (path.startsWith(`${base}/b/`) || path.startsWith(`${base}/t/`)) return false;
	if (item.key === 'overview') return path === base;
	if (!item.href) return false;
	return isProjectNavActive(item as ProjectNavItem, path, ws, proj);
}
