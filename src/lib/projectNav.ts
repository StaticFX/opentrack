import {
	LayoutDashboard,
	Milestone,
	Tag,
	ChartColumn,
	Activity,
	Lightbulb,
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
	{ key: 'suggestions', label: 'Suggestions', icon: Lightbulb, href: (w, p) => `/${w}/${p}/suggestions`, external: true },
	{ key: 'settings', label: 'Settings', icon: Settings, href: (w, p) => `/w/${w}/p/${p}/settings`, manageOnly: true }
];

/** Whether a nav item is the active destination for the current path. */
export function isProjectNavActive(item: ProjectNavItem, path: string, ws: string, proj: string): boolean {
	const href = item.href(ws, proj);
	return item.exact ? path === href : path.startsWith(href);
}
