<script lang="ts">
	import '../app.css';
	import ToastHost from '$lib/components/ui/ToastHost.svelte';

	let { children } = $props();

	// Layouts that haven't stamped id="main" yet still get a working skip:
	// fall back to the first <main> landmark.
	function skip(e: MouseEvent) {
		const target = document.getElementById('main') ?? document.querySelector('main');
		if (!target) return;
		e.preventDefault();
		target.setAttribute('tabindex', '-1');
		target.focus();
	}
</script>

<a
	href="#main"
	onclick={skip}
	class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-[13px] focus:font-medium focus:text-neutral-900 focus:shadow-lg focus:outline-2 focus:outline-offset-2 focus:outline-[var(--accent-solid)] dark:focus:bg-neutral-900 dark:focus:text-neutral-100"
>
	Skip to content
</a>

{@render children()}

<ToastHost />
