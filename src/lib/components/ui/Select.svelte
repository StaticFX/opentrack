<script lang="ts">
	import { tick } from 'svelte';
	import { Check, ChevronDown } from '@lucide/svelte';
	import { clickOutside } from '$lib/utils/clickOutside';
	import { cn } from '$lib/utils/cn';

	type Option = { value: string; label: string; color?: string };
	type Props = {
		value?: string;
		options: Option[];
		onchange?: (value: string) => void;
		/** Renders a hidden input so the value posts inside a <form>. */
		name?: string;
		/** Submit the enclosing form when the value changes. */
		autosubmit?: boolean;
		placeholder?: string;
		disabled?: boolean;
		class?: string;
		size?: 'sm' | 'md';
	};
	let {
		value = $bindable(''),
		options,
		onchange,
		name,
		autosubmit = false,
		placeholder = 'Select…',
		disabled = false,
		class: klass,
		size = 'md'
	}: Props = $props();

	let open = $state(false);
	let hidden = $state<HTMLInputElement | undefined>();
	const current = $derived(options.find((o) => o.value === value));

	async function choose(v: string) {
		value = v;
		open = false;
		onchange?.(v);
		if (autosubmit) {
			await tick();
			hidden?.form?.requestSubmit();
		}
	}

	const trigger = $derived(size === 'sm' ? 'h-7 px-2 text-xs' : 'h-9 px-2.5 text-sm');
</script>

<div class={cn('relative', klass)}>
	{#if name}<input type="hidden" {name} {value} bind:this={hidden} />{/if}
	<button
		type="button"
		{disabled}
		onclick={() => (open = !open)}
		class={cn(
			'flex w-full items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white text-left text-neutral-800 transition-colors hover:bg-neutral-50 focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800',
			trigger
		)}
	>
		<span class="flex min-w-0 items-center gap-1.5 truncate">
			{#if current?.color}<span class="size-2.5 shrink-0 rounded-full" style={`background:${current.color}`}></span>{/if}
			<span class={cn('truncate', !current && 'text-neutral-400')}>{current?.label ?? placeholder}</span>
		</span>
		<ChevronDown size={14} class="shrink-0 text-neutral-400" />
	</button>

	{#if open}
		<div
			use:clickOutside={() => (open = false)}
			class="absolute z-30 mt-1 max-h-60 w-full min-w-max overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
		>
			{#each options as o (o.value)}
				<button
					type="button"
					onclick={() => choose(o.value)}
					class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
				>
					{#if o.color}<span class="size-2.5 shrink-0 rounded-full" style={`background:${o.color}`}></span>{/if}
					<span class="flex-1 truncate">{o.label}</span>
					{#if o.value === value}<Check size={14} class="text-brand-600" />{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
