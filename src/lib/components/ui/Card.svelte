<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	type Props = {
		padding?: 'none' | 'sm' | 'md' | 'lg';
		/** `.glow-int` hover idiom — the internal interactive-card look. */
		interactive?: boolean;
		href?: string;
		as?: string;
		class?: string;
		children: Snippet;
	} & HTMLAttributes<HTMLElement> &
		HTMLAnchorAttributes;

	let {
		padding = 'md',
		interactive = false,
		href,
		as = 'div',
		class: klass,
		children,
		...rest
	}: Props = $props();

	const paddings: Record<NonNullable<Props['padding']>, string> = {
		none: '',
		sm: 'p-2',
		md: 'p-4',
		lg: 'p-6'
	};

	// glow-int carries its own hairline border at rest.
	const classes = $derived(
		cn(
			'block rounded-xl bg-white dark:bg-neutral-900',
			interactive ? 'glow-int' : 'hairline',
			href && 'focus-ring',
			paddings[padding],
			klass
		)
	);
</script>

{#if href}
	<a {href} class={classes} {...rest}>{@render children()}</a>
{:else}
	<svelte:element this={as} class={classes} {...rest}>{@render children()}</svelte:element>
{/if}
