<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';
	import { getFieldContext } from './Field.svelte';

	type Props = {
		checked?: boolean;
		/** Form-postable: posts `on` while checked, absent otherwise (checkbox semantics). */
		name?: string;
		label?: string;
		onchange?: (checked: boolean) => void;
		class?: string;
	} & Omit<HTMLButtonAttributes, 'onchange' | 'type'>;
	let { checked = $bindable(false), name, label, onchange, class: klass, ...rest }: Props = $props();

	const field = getFieldContext();

	function toggle() {
		checked = !checked;
		onchange?.(checked);
	}
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	{...rest}
	id={rest.id ?? field?.id}
	aria-describedby={rest['aria-describedby'] ?? field?.describedBy}
	onclick={toggle}
	class={cn('focus-ring flex max-w-full items-center gap-2 rounded-md disabled:opacity-50', klass)}
>
	<span
		aria-hidden="true"
		class={cn(
			'flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 ring-1 ring-black/10 transition-colors duration-[120ms] ring-inset motion-reduce:transition-none dark:ring-white/10',
			checked ? 'bg-[var(--accent-solid)]' : 'bg-neutral-300 dark:bg-neutral-600'
		)}
	>
		<span
			class={cn(
				'size-3 rounded-full bg-white shadow-sm transition-transform duration-[120ms] motion-reduce:transition-none',
				checked && 'translate-x-3'
			)}
		></span>
	</span>
	{#if label}
		<span class="min-w-0 truncate text-[13px] text-neutral-700 dark:text-neutral-200">{label}</span>
	{/if}
</button>
{#if name && checked}
	<input type="hidden" {name} value="on" />
{/if}
