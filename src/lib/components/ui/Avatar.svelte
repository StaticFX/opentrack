<script lang="ts">
	import { PALETTE } from '$lib/colors';
	import { cn } from '$lib/utils/cn';

	type Props = {
		src?: string | null;
		name: string;
		size?: 16 | 20 | 24 | 32;
		class?: string;
	};
	let { src, name, size = 24, class: klass }: Props = $props();

	const SIZES: Record<NonNullable<Props['size']>, string> = {
		16: 'size-4 text-[7px]',
		20: 'size-5 text-[8px]',
		24: 'size-6 text-[10px]',
		32: 'size-8 text-[12px]'
	};

	// Broken image URLs fall back to initials without a layout jump.
	let failedSrc = $state<string | null>(null);
	const showImg = $derived(Boolean(src) && failedSrc !== src);

	const initials = $derived.by(() => {
		const parts = name.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return '?';
		const chars = parts.slice(0, 2).map((p) => p[0]!.toUpperCase());
		return (size < 24 ? chars.slice(0, 1) : chars).join('');
	});

	// Deterministic identity tint from the name, drawn from the shared palette.
	const tint = $derived.by(() => {
		let h = 0;
		for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
		return PALETTE[h % PALETTE.length];
	});
</script>

<span
	class={cn(
		'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium select-none',
		SIZES[size],
		!showImg && 'text-neutral-700 dark:text-neutral-200',
		klass
	)}
	style={showImg ? undefined : `background: color-mix(in oklab, ${tint} 22%, transparent)`}
	role={showImg ? undefined : 'img'}
	aria-label={showImg ? undefined : name}
>
	{#if showImg}
		<img
			src={src}
			alt={name}
			class="size-full object-cover"
			onerror={() => (failedSrc = src ?? null)}
		/>
	{:else}
		<span aria-hidden="true" class="leading-none">{initials}</span>
	{/if}
</span>
