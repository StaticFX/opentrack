<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	type Tone = 'neutral' | 'accent' | 'green' | 'amber' | 'red' | 'violet';
	type Props = {
		tone?: Tone;
		size?: 'sm' | 'md';
		icon?: Component;
		class?: string;
		children: Snippet;
	};
	let { tone = 'neutral', size = 'sm', icon: Icon, class: klass, children }: Props = $props();

	// Tone map mirrors the existing status colors (open gray / accepted green /
	// declined red / converted-teal folds into green; violet for PR/beta cues).
	const tones: Record<Tone, string> = {
		neutral: 'border-neutral-500/20 bg-neutral-500/10 text-neutral-600 dark:text-neutral-400',
		accent: 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-fg)]',
		green: 'border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-400',
		amber: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
		red: 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400',
		violet: 'border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-400'
	};
</script>

<span
	class={cn(
		'inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap tabular-nums',
		size === 'sm' ? 'h-[18px] px-1.5 text-[11px]' : 'h-5 px-2 text-xs',
		tones[tone],
		klass
	)}
>
	{#if Icon}<Icon size={size === 'sm' ? 11 : 12} class="shrink-0" aria-hidden="true" />{/if}
	{@render children()}
</span>
