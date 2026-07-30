<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';

	// Informational cookie notice — OpenTrack sets only strictly-necessary
	// cookies, so this informs (it does not gate). Dismissal is remembered in
	// localStorage, which avoids ironically setting another cookie for the notice.
	let { text, enabled = true }: { text: string; enabled?: boolean } = $props();

	const STORAGE_KEY = 'ot:cookie-notice:v1';
	let show = $state(false);

	onMount(() => {
		if (!enabled) return;
		try {
			if (!localStorage.getItem(STORAGE_KEY)) show = true;
		} catch {
			show = true; // storage blocked → still inform once per page
		}
	});

	function dismiss() {
		show = false;
		try {
			localStorage.setItem(STORAGE_KEY, '1');
		} catch {
			/* ignore */
		}
	}

	const dur = $derived(prefersReducedMotion.current ? 0 : 180);
</script>

{#if show}
	<div
		class="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--rule)] bg-[color-mix(in_srgb,var(--ground)_94%,transparent)] backdrop-blur-md"
		role="region"
		aria-label="Cookie-Hinweis"
		transition:fly={{ y: 20, duration: dur }}
	>
		<div
			class="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6"
		>
			<p class="text-[12px] leading-relaxed text-[var(--dim)]">
				{text}
				<a
					href="/datenschutz"
					class="mono-focus ml-1 whitespace-nowrap text-[var(--accent)] underline hover:no-underline"
					>Mehr in der Datenschutzerklärung</a
				>
			</p>
			<button
				type="button"
				onclick={dismiss}
				class="mono-focus shrink-0 self-start border border-[var(--accent)] px-4 py-1.5 text-[12px] tracking-tight text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--ground)] sm:self-auto"
			>
				Verstanden
			</button>
		</div>
	</div>
{/if}
