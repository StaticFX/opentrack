<script lang="ts">
	import { Check } from '@lucide/svelte';
	import BrandIcon from './BrandIcon.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
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

	const disabled = $derived(status === 'soon' || status === 'unavailable');

	const badgeTone: Record<Status, 'green' | 'neutral' | 'amber'> = {
		connected: 'green',
		disconnected: 'neutral',
		soon: 'amber',
		unavailable: 'neutral'
	};
	const badgeLabel: Record<Status, string> = {
		connected: 'Connected',
		disconnected: 'Not connected',
		soon: 'Coming soon',
		unavailable: 'Unavailable'
	};
</script>

<button
	type="button"
	{onclick}
	{disabled}
	aria-pressed={selected}
	class={cn(
		'mono-focus group flex w-full flex-col gap-2 border p-4 text-left transition-colors',
		selected ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_9%,transparent)]' : 'border-[var(--rule)] hover:border-[color-mix(in_srgb,var(--text)_22%,transparent)]',
		disabled && 'cursor-not-allowed opacity-60 hover:border-[var(--rule)]'
	)}
>
	<div class="flex items-center gap-2.5">
		<div
			class={cn(
				'grid size-9 shrink-0 place-items-center rounded-[3px]',
				status === 'connected' ? 'bg-[var(--accent)] text-[var(--ground)]' : 'bg-[var(--raised)] text-[var(--dim)]'
			)}
		>
			<BrandIcon name={icon} size={18} />
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-1.5">
				<span class="mono-display truncate text-sm text-[var(--text)]">{name}</span>
				{#if status === 'connected'}<Check size={13} class="shrink-0 text-[var(--green)]" />{/if}
			</div>
			<Badge tone={badgeTone[status]} class="mt-0.5">{badgeLabel[status]}</Badge>
		</div>
	</div>
	<p class="text-xs leading-relaxed text-[var(--dim)]">{blurb}</p>
</button>
