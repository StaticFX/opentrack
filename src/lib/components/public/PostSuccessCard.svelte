<script lang="ts">
	import { Bell, X } from '@lucide/svelte';

	type Props = { ondismiss: () => void; watching: boolean };
	let { ondismiss, watching }: Props = $props();

	// The journey a piece of feedback travels, as a mono ordered log — glyphs, not
	// filled icon tiles. Numbers/steps read as a document, not a card.
	const steps = [
		'The community votes and reacts',
		'Maintainers review — accepted, declined, or merged',
		'Accepted ideas become tracked work you can follow to shipped'
	];
</script>

<section class="ot-rise relative border-t-2 border-[var(--accent)] pt-5">
	<button onclick={ondismiss} class="mono-focus absolute top-3 right-0 p-1 text-[var(--faint)] transition-colors hover:text-[var(--text)]" aria-label="Dismiss">
		<X size={16} />
	</button>
	<p class="text-[11px] tracking-[0.2em] text-[var(--accent)] uppercase">// now live</p>
	<h2 class="mono-display mt-2 text-xl text-[var(--text)]">It's live! Here's the road ahead.</h2>
	<ol class="mt-4 space-y-2">
		{#each steps as step, i (i)}
			<li class="flex items-baseline gap-3 text-[13px] text-[var(--dim)]">
				<span class="shrink-0 tabular-nums text-[var(--accent)]">{(i + 1).toString().padStart(2, '0')}</span>
				<span>{step}</span>
			</li>
		{/each}
	</ol>
	{#if watching}
		<p class="mt-4 flex items-center gap-1.5 text-[12px] text-[var(--accent)]">
			<Bell size={12} /> You're watching this — we'll nudge you at every stop.
		</p>
	{/if}
</section>
