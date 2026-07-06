import type { Priority } from '$lib/constants';
import { PRIORITY_META } from '$lib/priority';

// ── Priority ⇄ GitHub label mapping ──────────────────────────────────────────
// OpenTrack's ticket priority is mirrored to a dedicated `priority: <level>`
// GitHub label. Inbound, such a label sets the ticket's priority; all other
// labels sync as normal ticket labels. The `none` priority has no label.

export const PRIORITY_LABEL_PREFIX = 'priority: ';

/** GitHub label name for a ticket priority, or null for `none`. */
export function priorityLabelName(priority: Priority): string | null {
	return priority === 'none' ? null : `${PRIORITY_LABEL_PREFIX}${priority}`;
}

/** True if a label name is one of our managed `priority: <level>` labels. */
export function isPriorityLabel(name: string): boolean {
	return parsePriorityLabel(name) !== null;
}

/** The Priority encoded by a label name, or null if it isn't a priority label. */
export function parsePriorityLabel(name: string): Priority | null {
	const lower = name.trim().toLowerCase();
	if (!lower.startsWith(PRIORITY_LABEL_PREFIX)) return null;
	const level = lower.slice(PRIORITY_LABEL_PREFIX.length).trim();
	return level === 'low' || level === 'medium' || level === 'high' || level === 'urgent'
		? level
		: null;
}

/**
 * Derive a ticket priority from a set of issue label names. Highest-ranked
 * priority label wins; returns 'none' when no priority label is present.
 */
export function priorityFromLabels(names: string[]): Priority {
	let best: Priority = 'none';
	for (const n of names) {
		const p = parsePriorityLabel(n);
		if (p && PRIORITY_META[p].rank > PRIORITY_META[best].rank) best = p;
	}
	return best;
}

/** The full set of managed priority labels (name + hex color) to seed a repo. */
export function priorityLabelSpecs(): Array<{ name: string; color: string }> {
	return (['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => ({
		name: priorityLabelName(p)!,
		color: PRIORITY_META[p].color
	}));
}
