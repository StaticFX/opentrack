<!--
	ProviderButton — one row in the auth card's provider list. Real link to
	`/auth/oauth/{key}{redirectParam}` — the caller resolves that href. The
	icon is resolved the same way the rest of the app does (BrandIcon: brand
	logo / image URL / emoji / semantic fallback), so this works for any
	dynamically-configured provider, not just the three well-known brands.
	Hover tint uses the brand's official color when known (via brands.ts),
	falling back to the app accent for custom providers. ClickSpark fires the
	signature spark on click/keyboard activation.
-->
<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import ClickSpark from '$lib/components/vendor/ClickSpark.svelte';
	import BrandIcon from '$lib/components/integrations/BrandIcon.svelte';
	import { brandFor } from '$lib/integrations/brands';

	type Props = { href: string; label: string; icon: string };
	let { href, label, icon }: Props = $props();

	const tint = $derived(brandFor(icon)?.hex ?? 'var(--accent)');
</script>

<ClickSpark sparkColor={tint} class="block">
	<a
		{href}
		class="focus-ring provider-btn group relative flex h-12 w-full items-center gap-3 overflow-hidden rounded-xl px-4 text-sm font-medium transition-[border-color,transform,box-shadow] duration-150 ease-[var(--ease-swift)] active:scale-[0.99]"
		style="--tint:{tint};"
	>
		<span
			class="grid size-7 shrink-0 place-items-center rounded-lg transition-colors duration-150"
			style="background: color-mix(in oklab, var(--tint) 16%, transparent); color: var(--tint);"
		>
			<BrandIcon name={icon} size={15} />
		</span>
		<span class="min-w-0 flex-1 text-left text-[var(--ab-text)]">Continue with {label}</span>
		<ChevronRight
			size={15}
			class="shrink-0 text-[var(--ab-text-faint)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--tint)]"
		/>
	</a>
</ClickSpark>

<style>
	.provider-btn {
		background: var(--ab-surface-2);
		border: 1px solid var(--ab-line);
	}
	.provider-btn:hover,
	.provider-btn:focus-visible {
		border-color: color-mix(in oklab, var(--tint) 55%, transparent);
		box-shadow: 0 0 0 1px color-mix(in oklab, var(--tint) 30%, transparent), 0 8px 22px -12px var(--tint);
	}
</style>
