// Fractional ranking for ordered lists (client- and server-safe — no deps).
// `midString(a, b)` returns a key strictly between `a` and `b`; an empty `a`
// means "start of list", an empty `b` means "end of list". Dragging an item
// only rewrites that item's key — never the whole list.

const LOW = 96; // just below 'a'
const HIGH = 123; // just above 'z'

export function midString(a: string, b: string): string {
	let i = 0;
	let result = '';
	for (;;) {
		const aVal = i < a.length ? a.charCodeAt(i) : LOW;
		const bVal = i < b.length ? b.charCodeAt(i) : HIGH;
		if (aVal === bVal) {
			result += String.fromCharCode(aVal);
			i++;
			continue;
		}
		const mid = Math.floor((aVal + bVal) / 2);
		if (mid === aVal) {
			result += String.fromCharCode(aVal);
			i++;
			continue;
		}
		result += String.fromCharCode(mid);
		return result;
	}
}

export const rankAfter = (last: string | null | undefined): string => midString(last ?? '', '');
export const rankBefore = (first: string | null | undefined): string => midString('', first ?? '');
export const rankBetween = (a: string, b: string): string => midString(a, b);

/** Generate `n` increasing ranks for seeding a fresh ordered list. */
export function initialRanks(n: number): string[] {
	const out: string[] = [];
	let last = '';
	for (let i = 0; i < n; i++) {
		last = midString(last, '');
		out.push(last);
	}
	return out;
}

/** Rank for an item dropped between two neighbors (either may be absent). */
export function rankForDrop(
	prev: string | null | undefined,
	next: string | null | undefined
): string {
	if (prev && next) return rankBetween(prev, next);
	if (next) return rankBefore(next);
	if (prev) return rankAfter(prev);
	return rankAfter(null);
}
