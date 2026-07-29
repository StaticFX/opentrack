<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { LoaderCircle } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';

	type Variant = 'primary' | 'accent' | 'default' | 'ghost' | 'danger';
	type Size = 'sm' | 'md' | 'icon' | 'icon-sm';

	type Props = {
		variant?: Variant;
		size?: Size;
		href?: string;
		/** Width-preserving spinner; also disables the button while true. */
		loading?: boolean;
		pill?: boolean;
		class?: string;
		children: Snippet;
	} & HTMLButtonAttributes &
		HTMLAnchorAttributes;

	let {
		variant = 'default',
		size = 'md',
		href,
		loading = false,
		pill = false,
		class: klass,
		children,
		...rest
	}: Props = $props();

	const base =
		'focus-ring relative inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-[color,background-color,border-color,opacity,transform] duration-[90ms] ease-[var(--ease-swift)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50';

	const variants: Record<Variant, string> = {
		primary: 'bg-brand-600 text-white hover:bg-brand-700',
		/* Project-accent CTA for public pages (driven by the .accent-scope vars). */
		accent: 'bg-[var(--accent-solid)] text-white hover:bg-[var(--accent-solid-hover)]',
		default:
			'border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800',
		ghost:
			'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100',
		danger: 'bg-red-600 text-white hover:bg-red-700'
	};

	/* Icon buttons align to the sm/md control heights. */
	const sizes: Record<Size, string> = {
		sm: 'h-7 px-2.5 text-xs',
		md: 'h-9 px-3.5 text-sm',
		icon: 'h-9 w-9 text-sm',
		'icon-sm': 'h-7 w-7 text-xs'
	};

	const spinnerSize = $derived(size === 'sm' || size === 'icon-sm' ? 14 : 16);
	const classes = $derived(
		cn(
			base,
			variants[variant],
			sizes[size],
			pill && 'rounded-full',
			loading && href && 'pointer-events-none',
			klass
		)
	);
</script>

{#snippet inner()}
	{#if loading}
		<span class="absolute inset-0 grid place-items-center">
			<LoaderCircle size={spinnerSize} class="animate-spin motion-reduce:animate-none" aria-hidden="true" />
		</span>
	{/if}
	<span class={cn('inline-flex min-w-0 items-center gap-1.5', loading && 'invisible')}>
		{@render children()}
	</span>
{/snippet}

{#if href}
	<a {href} class={classes} aria-busy={loading || undefined} {...rest}>{@render inner()}</a>
{:else}
	<button class={classes} {...rest} disabled={loading || rest.disabled} aria-busy={loading || undefined}>
		{@render inner()}
	</button>
{/if}
