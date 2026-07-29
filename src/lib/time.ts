/** Compact relative-time formatter ("just now", "5m ago", "3d ago"). Client-safe. */
export function ago(d: string | Date): string {
	const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
	if (s < 60) return 'just now';
	if (s < 3600) return `${Math.floor(s / 60)}m ago`;
	if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
	if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
	return new Date(d).toLocaleDateString();
}

export interface DueMeta {
	/** Compact relative label — future dates render "in 3d" (never "just now"). */
	label: string;
	overdue: boolean;
	/** Due within 48h — the amber threshold shared with the board card meta row. */
	soon: boolean;
}

/**
 * Due-date label with overdue/soon flags for ticket rows. Fixes the former
 * per-page `dueMeta` bug where `ago()` (past-only) was reused for future
 * dates and always printed "just now"/"Due just now".
 */
export function dueMeta(due: Date | string | null | undefined): DueMeta | null {
	if (!due) return null;
	const d = new Date(due).getTime();
	if (Number.isNaN(d)) return null;
	const diff = d - Date.now();
	const MIN = 60_000;
	const HOUR = 3_600_000;
	const DAY = 86_400_000;
	const WEEK = 604_800_000;
	if (diff <= 0) return { label: 'Overdue', overdue: true, soon: false };
	const soon = diff < 48 * HOUR;
	let label: string;
	if (diff < HOUR) label = `in ${Math.max(1, Math.floor(diff / MIN))}m`;
	else if (diff < DAY) label = `in ${Math.floor(diff / HOUR)}h`;
	else if (diff < WEEK) label = `in ${Math.floor(diff / DAY)}d`;
	else label = `in ${Math.floor(diff / WEEK)}w`;
	return { label, overdue: false, soon };
}
