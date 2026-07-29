<script lang="ts">
	import AnimatedNumber from './AnimatedNumber.svelte';

	type Props = { value: number; label: string; sub?: string; accent?: boolean };
	let { value, label, sub, accent = false }: Props = $props();
</script>

<!-- Mono stat: a big Space Mono numeral over a tracked mono label. No card box —
     hierarchy is type + space. Cobalt only when this is the view's key figure. -->
<div>
	<AnimatedNumber
		{value}
		class={`mono-display block text-3xl leading-none ${accent ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}
	/>
	<p class="mt-2 text-[11px] tracking-[0.14em] text-[var(--faint)] uppercase">{label}</p>
	{#if sub}<p class="mt-0.5 text-[11px] tabular-nums text-[var(--faint)]">{sub}</p>{/if}
</div>
