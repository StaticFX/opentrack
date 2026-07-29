<script lang="ts">
	import type { Component } from 'svelte';
	import Button from './Button.svelte';
	import { cn } from '$lib/utils/cn';

	// Internal empty state: dot-textured well, neutral voice — the fact plus at
	// most one action. `compact` collapses to a single 32px line.
	type Props = {
		icon: Component;
		title: string;
		body?: string;
		action?: { label: string; href?: string; onclick?: () => void };
		compact?: boolean;
		class?: string;
	};
	let { icon: Icon, title, body, action, compact = false, class: klass }: Props = $props();
</script>

{#if compact}
	<div
		class={cn(
			'hairline flex h-8 items-center gap-2 rounded-lg px-3 text-[13px] text-neutral-500 dark:text-neutral-400',
			klass
		)}
	>
		<Icon size={14} class="shrink-0 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
		<span class="min-w-0 flex-1 truncate">{title}</span>
		{#if action}
			<Button size="sm" variant="ghost" href={action.href} onclick={action.onclick}>{action.label}</Button>
		{/if}
	</div>
{:else}
	<div
		class={cn(
			'texture-dots hairline flex flex-col items-center justify-center gap-2 rounded-xl px-6 py-10 text-center',
			klass
		)}
	>
		<Icon size={20} class="text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
		<p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{title}</p>
		{#if body}
			<p class="max-w-sm text-[13px] text-neutral-500 dark:text-neutral-400">{body}</p>
		{/if}
		{#if action}
			<div class="mt-2">
				<Button size="sm" href={action.href} onclick={action.onclick}>{action.label}</Button>
			</div>
		{/if}
	</div>
{/if}
