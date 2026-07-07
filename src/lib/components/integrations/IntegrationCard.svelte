<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { iconFor } from '$lib/integrations/icons';
	import { cn } from '$lib/utils/cn';

	type Status = 'connected' | 'disconnected' | 'soon' | 'unavailable';

	let {
		name,
		blurb,
		icon,
		status = 'disconnected',
		selected = false,
		onclick
	}: {
		name: string;
		blurb: string;
		icon: string;
		status?: Status;
		selected?: boolean;
		onclick?: () => void;
	} = $props();

	const Icon = $derived(iconFor(icon));
	const disabled = $derived(status === 'soon' || status === 'unavailable');

	const badge: Record<Status, { label: string; class: string }> = {
		connected: {
			label: 'Connected',
			class: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
		},
		disconnected: {
			label: 'Not connected',
			class: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
		},
		soon: {
			label: 'Coming soon',
			class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
		},
		unavailable: {
			label: 'Unavailable',
			class: 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'
		}
	};
</script>

<button
	type="button"
	{onclick}
	{disabled}
	class={cn(
		'group flex w-full flex-col gap-2 rounded-xl border p-4 text-left transition',
		selected
			? 'border-brand-500 bg-brand-50/40 ring-1 ring-brand-500 dark:bg-brand-500/10'
			: 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700',
		disabled && 'cursor-not-allowed opacity-60 hover:border-neutral-200 dark:hover:border-neutral-800'
	)}
>
	<div class="flex items-center gap-2.5">
		<div
			class={cn(
				'grid size-9 shrink-0 place-items-center rounded-lg',
				status === 'connected'
					? 'bg-brand-500 text-white'
					: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300'
			)}
		>
			<Icon size={18} />
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-1.5">
				<span class="truncate text-sm font-semibold">{name}</span>
				{#if status === 'connected'}<Check size={13} class="shrink-0 text-green-500" />{/if}
			</div>
			<span class={cn('mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium', badge[status].class)}>
				{badge[status].label}
			</span>
		</div>
	</div>
	<p class="text-xs leading-relaxed text-neutral-500">{blurb}</p>
</button>
