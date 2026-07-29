import { beforeNavigate, goto } from '$app/navigation';
import { derived, get, writable, type Readable } from 'svelte/store';

const DEFAULT_KEY = 'default';

export type DirtyGuard = {
	/** True while any tracked form has unsaved edits. */
	dirty: Readable<boolean>;
	/** True while a navigation is blocked awaiting the user's decision — wire
	 * this to a confirm dialog whose buttons call `discard()` / `stay()`. */
	pending: Readable<boolean>;
	/** Mark a form touched. Keys allow several forms per page. */
	markDirty(key?: string): void;
	/** Mark a form clean (after save or reset). */
	markClean(key?: string): void;
	isDirty(key?: string): boolean;
	/** Clear every tracked form. */
	reset(): void;
	/** Drop the edits and resume the blocked navigation. */
	discard(): void;
	/** Stay on the page, keeping the edits. */
	stay(): void;
};

/**
 * Tracks touched forms and blocks navigation while any is dirty — covers
 * `?tab=` switches AND route exits (both go through SvelteKit's router).
 * Tab/window closes cancel the navigation, which surfaces the native unload
 * prompt instead.
 *
 * Must be called during component initialisation (it registers
 * `beforeNavigate`).
 */
export function createDirtyGuard(): DirtyGuard {
	const keys = writable<ReadonlySet<string>>(new Set());
	const blockedHref = writable<string | null>(null);

	const update = (fn: (s: Set<string>) => void) =>
		keys.update((s) => {
			const next = new Set(s);
			fn(next);
			return next;
		});

	beforeNavigate((nav) => {
		if (get(keys).size === 0) return;
		if (nav.type === 'leave' || nav.willUnload) {
			// Unload navigations can't be resumed — cancelling raises the
			// browser's own prompt.
			nav.cancel();
			return;
		}
		if (get(blockedHref) !== null) return; // already prompting
		nav.cancel();
		blockedHref.set(nav.to?.url.href ?? null);
	});

	return {
		dirty: derived(keys, (s) => s.size > 0),
		pending: derived(blockedHref, (h) => h !== null),
		markDirty: (key = DEFAULT_KEY) => update((s) => void s.add(key)),
		markClean: (key = DEFAULT_KEY) => update((s) => void s.delete(key)),
		isDirty: (key = DEFAULT_KEY) => get(keys).has(key),
		reset: () => keys.set(new Set()),
		discard: () => {
			const href = get(blockedHref);
			blockedHref.set(null);
			keys.set(new Set());
			if (href) void goto(href).catch(() => location.assign(href));
		},
		stay: () => blockedHref.set(null)
	};
}
