<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	type Variant = 'primary' | 'default' | 'ghost' | 'danger';
	type Size = 'sm' | 'md' | 'icon';

	type Props = {
		variant?: Variant;
		size?: Size;
		href?: string;
		class?: string;
		children: Snippet;
	} & HTMLButtonAttributes &
		HTMLAnchorAttributes;

	let {
		variant = 'default',
		size = 'md',
		href,
		class: klass,
		children,
		...rest
	}: Props = $props();

	const base =
		'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap';

	const variants: Record<Variant, string> = {
		primary: 'bg-brand-600 text-white hover:bg-brand-700',
		default:
			'border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800',
		ghost:
			'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100',
		danger: 'bg-red-600 text-white hover:bg-red-700'
	};

	const sizes: Record<Size, string> = {
		sm: 'h-7 px-2.5 text-xs',
		md: 'h-9 px-3.5 text-sm',
		icon: 'h-8 w-8 text-sm'
	};

	const classes = $derived(cn(base, variants[variant], sizes[size], klass));
</script>

{#if href}
	<a {href} class={classes} {...rest}>{@render children()}</a>
{:else}
	<button class={classes} {...rest}>{@render children()}</button>
{/if}
