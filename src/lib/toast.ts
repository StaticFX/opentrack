import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { announce } from '$lib/announce';

export type ToastTone = 'success' | 'error' | 'info';
export type ToastAction = { label: string; fn: () => void };
export type ToastItem = {
	id: number;
	msg: string;
	tone: ToastTone;
	action?: ToastAction;
	duration: number;
};
export type ToastOptions = { tone?: ToastTone; action?: ToastAction; duration?: number };

/** Rendered by ToastHost (mounted once in the root layout). */
export const toasts = writable<ToastItem[]>([]);

let seq = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function dismissToast(id: number): void {
	const timer = timers.get(id);
	if (timer) clearTimeout(timer);
	timers.delete(id);
	toasts.update((list) => list.filter((t) => t.id !== id));
}

function push(msg: string, { tone = 'info', action, duration = 4000 }: ToastOptions = {}): number {
	const id = ++seq;
	toasts.update((list) => [...list, { id, msg, tone, action, duration }]);
	// The LiveRegion is the announcement channel — a toast alone is not one.
	announce(msg);
	if (browser) timers.set(id, setTimeout(() => dismissToast(id), duration));
	return id;
}

/** Fire a toast. Returns an id usable with `dismissToast`. */
export const toast = Object.assign(push, {
	/** Tier-1 destruction transport: message + Undo action, longer window. */
	undo(msg: string, fn: () => void): number {
		return push(msg, { action: { label: 'Undo', fn }, duration: 6000 });
	}
});
