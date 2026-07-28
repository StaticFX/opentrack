<script lang="ts">
	import { Bell, CheckCheck, Hammer, Users, X } from '@lucide/svelte';

	type Props = { ondismiss: () => void; watching: boolean };
	let { ondismiss, watching }: Props = $props();

	const steps = [
		{ icon: Users, text: 'The community votes and reacts' },
		{ icon: CheckCheck, text: 'Maintainers review — accepted, declined, or merged' },
		{ icon: Hammer, text: 'Accepted ideas become tracked work you can follow to shipped' }
	];
</script>

<div class="pub-card ot-rise relative overflow-hidden rounded-3xl p-5" style="background:linear-gradient(160deg, var(--accent-wash), transparent 60%)">
	<button onclick={ondismiss} class="absolute top-2 right-2 rounded-full p-2 text-neutral-400 hover:bg-black/5 hover:text-neutral-600 dark:hover:bg-white/10" aria-label="Dismiss">
		<X size={15} />
	</button>
	<h2 class="type-poster text-xl">It's live! Here's the road ahead.</h2>
	<ol class="mt-3 space-y-2">
		{#each steps as step, i (i)}
			{@const Icon = step.icon}
			<li class="flex items-center gap-2.5 text-sm text-neutral-600 dark:text-neutral-300">
				<span class="grid size-6 shrink-0 place-items-center rounded-full text-[var(--accent-fg)]" style="background:var(--accent-soft)">
					<Icon size={13} />
				</span>
				{step.text}
			</li>
		{/each}
	</ol>
	{#if watching}
		<p class="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-[var(--accent-fg)]">
			<Bell size={12} /> You're watching this — we'll nudge you at every stop.
		</p>
	{/if}
</div>
