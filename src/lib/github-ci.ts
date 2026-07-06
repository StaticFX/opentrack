/** Client-safe presentation for a PR's aggregate CI status. */

export interface CiMeta {
	label: string;
	/** Tailwind classes for a small status dot. */
	dotClass: string;
	/** Tailwind classes for a text/badge pill. */
	pillClass: string;
}

const META: Record<string, CiMeta> = {
	success: {
		label: 'Checks passing',
		dotClass: 'bg-green-500',
		pillClass: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
	},
	failure: {
		label: 'Checks failing',
		dotClass: 'bg-red-500',
		pillClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
	},
	pending: {
		label: 'Checks running',
		dotClass: 'bg-amber-400 animate-pulse',
		pillClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
	},
	error: {
		label: 'Checks need attention',
		dotClass: 'bg-orange-500',
		pillClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
	},
	neutral: {
		label: 'Checks complete',
		dotClass: 'bg-neutral-400',
		pillClass: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
	}
};

/** Presentation for a CI status, or null when there is none to show. */
export function ciMeta(status: string | null | undefined): CiMeta | null {
	if (!status) return null;
	return META[status] ?? null;
}
