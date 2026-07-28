<script lang="ts">
	import { Sun, Moon } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { getThemePref, resolveTheme, setThemePref, watchSystemTheme } from '$lib/theme';

	// Public pages get a simple light/dark switch (no "system" stop — the OS
	// preference still wins until the visitor touches the toggle).
	let dark = $state(false);
	onMount(() => {
		const sync = () => (dark = resolveTheme(getThemePref()) === 'dark');
		sync();
		// Keep icon + label in step when the OS scheme flips while pref=system.
		const unwatch = watchSystemTheme();
		const mq = matchMedia('(prefers-color-scheme: dark)');
		mq.addEventListener('change', sync);
		return () => {
			unwatch();
			mq.removeEventListener('change', sync);
		};
	});
	function toggle() {
		dark = !dark;
		setThemePref(dark ? 'dark' : 'light');
	}
</script>

<button
	type="button"
	onclick={toggle}
	class="grid size-8 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100"
	aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
	title={dark ? 'Light mode' : 'Dark mode'}
>
	{#if dark}<Sun size={16} />{:else}<Moon size={16} />{/if}
</button>
