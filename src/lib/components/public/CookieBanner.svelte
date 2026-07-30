<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import type { Lang } from '$lib/server/legal';

	// Informational cookie notice — OpenTrack sets only strictly-necessary
	// cookies, so this informs (it does not gate). Dismissal is remembered in
	// localStorage, which avoids ironically setting another cookie for the notice.
	// Bilingual: follows the language stored in localStorage (default English),
	// which the legal-page LangToggle writes.
	let {
		text,
		textEn,
		enabled = true
	}: { text: string; textEn: string; enabled?: boolean } = $props();

	const STORAGE_KEY = 'ot:cookie-notice:v1';
	let show = $state(false);
	let lang = $state<Lang>('en');

	const copy = $derived(
		lang === 'de'
			? { body: text, more: 'Mehr in der Datenschutzerklärung', ack: 'Verstanden', aria: 'Cookie-Hinweis' }
			: { body: textEn, more: 'Learn more in the privacy policy', ack: 'Got it', aria: 'Cookie notice' }
	);

	onMount(() => {
		try {
			if (localStorage.getItem('ot:lang') === 'de') lang = 'de';
		} catch {
			/* default en */
		}
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
		aria-label={copy.aria}
		transition:fly={{ y: 20, duration: dur }}
	>
		<div
			class="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6"
		>
			<p class="text-[12px] leading-relaxed text-[var(--dim)]">
				{copy.body}
				<a
					href={`/datenschutz?lang=${lang}`}
					class="mono-focus ml-1 whitespace-nowrap text-[var(--accent)] underline hover:no-underline"
					>{copy.more}</a
				>
			</p>
			<button
				type="button"
				onclick={dismiss}
				class="mono-focus shrink-0 self-start border border-[var(--accent)] px-4 py-1.5 text-[12px] tracking-tight text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--ground)] sm:self-auto"
			>
				{copy.ack}
			</button>
		</div>
	</div>
{/if}
