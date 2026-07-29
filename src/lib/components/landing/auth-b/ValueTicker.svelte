<!--
	ValueTicker — a rotating one-line value prop under the auth card, so
	whoever is staring at the sign-in card while it loads still gets sold
	on the product. Crossfades every ~3.4s; prefers-reduced-motion just
	shows the first line, statically, no timer.
-->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import { Eye, GitBranch, Lock, Megaphone } from '@lucide/svelte';
	import type { Component } from 'svelte';

	const items: { icon: Component; text: string }[] = [
		{ icon: Megaphone, text: 'Public roadmaps, by default.' },
		{ icon: Eye, text: 'Anonymous upvoting on every idea.' },
		{ icon: GitBranch, text: 'Two-way sync with GitHub Issues.' },
		{ icon: Lock, text: 'Self-hosted. MIT licensed. Yours.' }
	];

	let index = $state(0);
	let reduced = $state(true);

	$effect(() => {
		reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduced) return;
		const t = setInterval(() => {
			index = (index + 1) % items.length;
		}, 3400);
		return () => clearInterval(t);
	});

	const current = $derived(items[index]);
</script>

<div class="relative h-5 font-mono text-[12px] text-[var(--ab-text-faint)]">
	{#if reduced}
		{@const Icon = items[0].icon}
		<span class="flex h-5 items-center justify-center gap-2">
			<Icon size={13} class="shrink-0 text-[var(--accent-fg)]" aria-hidden="true" />
			{items[0].text}
		</span>
	{:else}
		{#key index}
			<span
				class="absolute inset-0 flex items-center justify-center gap-2 whitespace-nowrap"
				in:fade={{ duration: 260 }}
				out:fade={{ duration: 180 }}
			>
				<current.icon size={13} class="shrink-0 text-[var(--accent-fg)]" aria-hidden="true" />
				{current.text}
			</span>
		{/key}
	{/if}
</div>
