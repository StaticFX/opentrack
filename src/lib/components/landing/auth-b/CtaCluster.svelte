<!--
	CtaCluster — the closing offer: primary drives the funnel to the real
	sign-in route, secondary earns the star, tertiary lets a skeptical
	visitor poke around with zero commitment.
-->
<script lang="ts">
	import { ArrowRight, ArrowUpRight } from '@lucide/svelte';
	import ClickSpark from '$lib/components/vendor/ClickSpark.svelte';
	import StarBorder from '$lib/components/vendor/StarBorder.svelte';
	import BrandGlyph from './BrandGlyph.svelte';

	const REPO = 'https://github.com/StaticFX/opentrack';
</script>

<div class="flex flex-wrap items-center justify-center gap-3">
	<ClickSpark sparkColor="var(--accent)">
		<a
			href="/auth/login"
			class="focus-ring group inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white transition-[transform,box-shadow] duration-150 ease-[var(--ease-swift)] hover:-translate-y-px active:scale-[0.98]"
			style="background: var(--accent-solid); box-shadow: 0 1px 0 0 oklch(1 0 0 / 0.25) inset, 0 16px 36px -16px var(--accent-glow);"
		>
			Sign in
			<ArrowRight size={16} class="transition-transform duration-150 group-hover:translate-x-0.5" />
		</a>
	</ClickSpark>

	<StarBorder as="a" href={REPO} target="_blank" rel="noopener noreferrer" color="var(--accent)" radius="9999px" class="inline-flex">
		<span
			class="focus-ring inline-flex h-[46px] items-center gap-2 rounded-full px-6 text-[15px] font-medium"
			style="background:var(--ab-surface-2); color:var(--ab-text)"
		>
			<BrandGlyph provider="github" size={15} /> Star on GitHub
		</span>
	</StarBorder>

	<a
		href="/"
		class="focus-ring group inline-flex h-12 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium transition-colors"
		style="color:var(--ab-text-dim)"
	>
		Explore live demo
		<ArrowUpRight size={15} class="text-[var(--accent-fg)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
	</a>
</div>
