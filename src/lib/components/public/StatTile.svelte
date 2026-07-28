<script lang="ts">
	import AnimatedNumber from './AnimatedNumber.svelte';
	import SpotlightCard from '$lib/components/vendor/SpotlightCard.svelte';

	type Props = { value: number; label: string; sub?: string; accent?: boolean };
	let { value, label, sub, accent = false }: Props = $props();
</script>

<SpotlightCard class="pub-card px-4 py-3.5">
	<AnimatedNumber
		{value}
		class={`block text-3xl font-bold ${accent ? 'text-[var(--accent-fg)]' : ''}`}
	/>
	<p class="pub-label mt-1">{label}</p>
	{#if sub}<p class="mt-0.5 font-mono text-[11px] text-neutral-400 dark:text-neutral-500">{sub}</p>{/if}
</SpotlightCard>
