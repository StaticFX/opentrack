<script lang="ts">
	import Sparkline from '$lib/components/public/Sparkline.svelte';
	import { cn } from '$lib/utils/cn';

	// Linked-or-nothing: `href` is required — a stat that leads nowhere doesn't
	// compile. Value renders instantly (no CountUp inside the app).
	type Props = {
		label: string;
		value: number | string;
		href: string;
		/** 7-day trace rendered on the right. */
		spark?: number[];
		/** Accepted for API compatibility; the mono app is always cobalt, so a
		 * per-project accent override is intentionally ignored here. */
		accent?: string;
		class?: string;
	};
	// `accent` is deliberately not destructured — see the note above.
	let { label, value, href, spark, class: klass }: Props = $props();
</script>

<!-- No card: a hairline tile (mono interactive idiom — hairline at rest, cobalt
     ring on hover) with a big Space Mono number over a quiet mono label. -->
<a
	{href}
	class={cn(
		'glow-int focus-ring flex items-end justify-between gap-3 rounded-[4px] p-3',
		klass
	)}
>
	<div class="min-w-0">
		<div class="truncate text-[11px] font-medium tracking-wide text-[var(--dim)] uppercase">
			{label}
		</div>
		<div class="mono-display mt-1.5 text-2xl leading-none tabular-nums text-[var(--text)]">
			{value}
		</div>
	</div>
	{#if spark && spark.length > 0}
		<Sparkline values={spark} width={72} height={22} />
	{/if}
</a>
