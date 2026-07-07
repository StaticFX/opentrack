<script lang="ts">
	import { brandFor } from '$lib/integrations/brands';
	import { iconFor } from '$lib/integrations/icons';

	// `name` can be a provider/brand key ('github', 'discord', …), a Lucide
	// semantic name ('git-branch', 'plug', …), an emoji, or an image URL — this
	// resolves the best available glyph, preferring a real brand logo.
	let {
		name,
		size = 18,
		class: cls = ''
	}: { name: string | null | undefined; size?: number; class?: string } = $props();

	const brand = $derived(brandFor(name));
	const isUrl = $derived(!!name && /^https?:\/\//.test(name));
	// A short non-ascii string is treated as an emoji icon (custom providers).
	const isEmoji = $derived(
		!!name && !brand && !isUrl && [...name].length <= 3 && /[^\x00-\x7F]/.test(name)
	);
	const Fallback = $derived(brand || isUrl || isEmoji ? null : iconFor(name ?? 'plug'));
</script>

{#if brand}
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="currentColor"
		role="img"
		aria-hidden="true"
		class={cls}
	>
		<path d={brand.path} />
	</svg>
{:else if isUrl}
	<img src={name} alt="" width={size} height={size} class={cls} style="border-radius:4px;object-fit:cover" />
{:else if isEmoji}
	<span class={cls} style={`font-size:${size * 0.9}px;line-height:1`}>{name}</span>
{:else if Fallback}
	<Fallback {size} class={cls} />
{/if}
