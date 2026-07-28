import { writable } from 'svelte/store';

/** Message for the shared aria-live region (LiveRegion.svelte in the public shell). */
export const liveMessage = writable('');

let flip = false;
/** Announce to screen readers. A zero-width toggle re-triggers identical messages. */
export function announce(msg: string): void {
	flip = !flip;
	liveMessage.set(flip ? `${msg}​` : msg);
}
