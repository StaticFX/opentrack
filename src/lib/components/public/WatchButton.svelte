<script lang="ts">
	import { Bell, BellOff } from '@lucide/svelte';
	import { page } from '$app/state';
	import { clickOutside } from '$lib/utils/clickOutside';

	type Props = {
		subjectType: 'ticket' | 'suggestion';
		subjectId: string;
		watching?: boolean;
		signedIn: boolean;
	};
	let { subjectType, subjectId, watching = false, signedIn }: Props = $props();

	let w = $state(watching);
	$effect(() => {
		w = watching;
	});
	let nudge = $state(false);

	async function toggle() {
		if (!signedIn) {
			nudge = !nudge;
			return;
		}
		const prev = w;
		w = !w; // optimistic
		try {
			const res = await fetch('/api/watch', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ subjectType, subjectId, watch: w })
			});
			if (res.ok) w = (await res.json()).watching;
			else w = prev;
		} catch {
			w = prev;
		}
	}

	const loginHref = $derived(`/auth/login?redirect=${encodeURIComponent(page.url.pathname)}`);
</script>

<svelte:window onkeydown={(e) => nudge && e.key === 'Escape' && (nudge = false)} />

<div class="relative">
	<button
		onclick={toggle}
		class={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${w ? 'bg-[var(--accent-soft)] text-[var(--accent-fg)]' : 'text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10'}`}
		title={w ? 'Stop watching' : 'Watch for updates'}
		aria-pressed={signedIn ? w : undefined}
		aria-expanded={signedIn ? undefined : nudge}
	>
		{#if w}<Bell size={13} /> Watching{:else}<BellOff size={13} /> Watch{/if}
	</button>

	{#if nudge}
		<div
			use:clickOutside={() => (nudge = false)}
			class="pub-card absolute right-0 z-20 mt-1.5 w-56 p-3 text-left"
		>
			<p class="text-xs text-neutral-600 dark:text-neutral-300">
				Watching needs an account — sign in and we'll ping you at every step.
			</p>
			<a href={loginHref} class="mt-2 inline-block rounded-full bg-[var(--accent-solid)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-solid-hover)]">Sign in</a>
		</div>
	{/if}
</div>
