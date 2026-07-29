<script lang="ts" module>
	import { crossfade } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';

	// One shared FLIP pair for the whole rail: the 2px active bar slides between
	// rows on navigation (user-action feedback, not on-load — first mount and
	// cross-project unmounts fall back to an instant cut).
	const [barOut, barIn] = crossfade({
		duration: () => (prefersReducedMotion.current ? 0 : 200),
		easing: backOut,
		fallback: () => ({ duration: 0 })
	});
	const BAR_KEY = 'rail-active-bar';
	/** For non-NavRow rail rows (e.g. the notification bell) that carry the bar. */
	export { barIn as railBarIn, barOut as railBarOut, BAR_KEY as RAIL_BAR_KEY };
</script>

<script lang="ts">
	import type { Component } from 'svelte';
	import { ExternalLink } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';

	type Props = {
		href: string;
		icon?: Component;
		/** Colour chip rendered instead of an icon (project rows). */
		dot?: string | null;
		label: string;
		badge?: number | string;
		/** 'accent' = solid accent count pill (Triage/Inbox); 'quiet' = mono text. */
		badgeTone?: 'quiet' | 'accent';
		active: boolean;
		depth?: 0 | 1;
		external?: boolean;
		onclick?: () => void;
	};
	let {
		href,
		icon: Icon,
		dot,
		label,
		badge,
		badgeTone = 'quiet',
		active,
		depth = 0,
		external = false,
		onclick
	}: Props = $props();

	const badgeText = $derived(typeof badge === 'number' && badge > 99 ? '99+' : String(badge ?? ''));
</script>

<a
	{href}
	{onclick}
	aria-current={active ? 'page' : undefined}
	class={cn(
		'focus-ring relative flex items-center gap-2 rounded-lg px-2 text-[13px] transition-colors',
		depth === 1 ? 'h-7 pl-6' : 'h-8',
		active ? 'bg-white/10 font-medium text-white' : 'text-neutral-300 hover:bg-white/5 hover:text-white'
	)}
>
	{#if active}
		<span
			aria-hidden="true"
			class="absolute inset-y-1.5 left-0 w-0.5"
			style="background:var(--accent)"
			in:barIn={{ key: BAR_KEY }}
			out:barOut={{ key: BAR_KEY }}
		></span>
	{/if}
	{#if dot}
		<span
			aria-hidden="true"
			class="size-2.5 shrink-0 rounded-full ring-1 ring-white/10"
			style={`background:${dot}`}
		></span>
	{:else if Icon}
		<Icon
			size={depth === 1 ? 14 : 15}
			class={cn('shrink-0', active ? 'text-neutral-200' : 'text-neutral-400')}
			aria-hidden="true"
		/>
	{/if}
	<span class="min-w-0 flex-1 truncate">{label}</span>
	{#if badge !== undefined}
		{#if badgeTone === 'accent'}
			<span
				class="data-mono grid min-w-4 shrink-0 place-items-center rounded-full px-1.5 py-px font-semibold text-white"
				style="background:var(--accent-solid)">{badgeText}</span
			>
		{:else}
			<span class="data-mono shrink-0 text-neutral-400">{badgeText}</span>
		{/if}
	{/if}
	{#if external}
		<ExternalLink size={12} class="shrink-0 text-neutral-500" aria-hidden="true" />
	{/if}
</a>
