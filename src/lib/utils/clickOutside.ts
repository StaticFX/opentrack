import type { Action } from 'svelte/action';

/** Svelte action: call `callback` when a click lands outside `node`. */
export const clickOutside: Action<HTMLElement, () => void> = (node, callback) => {
	let cb = callback;
	function onClick(event: MouseEvent) {
		if (!node.contains(event.target as Node)) cb?.();
	}
	// Capture phase so it fires before inner handlers stop propagation.
	document.addEventListener('click', onClick, true);
	return {
		update(next) {
			cb = next;
		},
		destroy() {
			document.removeEventListener('click', onClick, true);
		}
	};
};
