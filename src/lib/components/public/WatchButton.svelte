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
		class={`mono-focus flex shrink-0 items-center gap-1.5 border px-2.5 py-1 text-[12px] transition-colors ${w ? 'border-[color-mix(in_srgb,var(--accent)_55%,transparent)] text-[var(--accent)]' : 'border-[var(--rule)] text-[var(--dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
		title={w ? 'Stop watching' : 'Watch for updates'}
		aria-pressed={signedIn ? w : undefined}
		aria-expanded={signedIn ? undefined : nudge}
	>
		{#if w}<Bell size={13} /> Watching{:else}<BellOff size={13} /> Watch{/if}
	</button>

	{#if nudge}
		<div
			use:clickOutside={() => (nudge = false)}
			class="absolute right-0 z-20 mt-1.5 w-56 border border-[var(--rule)] bg-[var(--raised)] p-3 text-left"
		>
			<p class="text-[12px] leading-relaxed text-[var(--dim)]">
				Watching needs an account — sign in and we'll ping you at every step.
			</p>
			<a href={loginHref} class="mono-focus mt-2 inline-flex items-center border border-[var(--accent)] px-3 py-1.5 text-[12px] text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--ground)]">Sign in →</a>
		</div>
	{/if}
</div>
