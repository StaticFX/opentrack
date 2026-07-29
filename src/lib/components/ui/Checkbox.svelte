<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';
	import { getFieldContext } from './Field.svelte';

	type Props = {
		checked?: boolean;
		name?: string;
		/** Inline label; omit inside a Field (the Field label associates itself). */
		label?: string;
		class?: string;
	} & Omit<HTMLInputAttributes, 'type'>;
	let { checked = $bindable(false), name, label, class: klass, ...rest }: Props = $props();

	const field = getFieldContext();
	const boxClass = (extra?: string) =>
		cn(
			'ot-checkbox focus-ring size-4 shrink-0 appearance-none rounded-[4px] border border-neutral-300 bg-white transition-colors duration-[90ms] checked:border-[var(--accent-solid)] checked:bg-[var(--accent-solid)] motion-reduce:transition-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900',
			extra
		);
</script>

{#snippet box(extra?: string)}
	<input
		type="checkbox"
		bind:checked
		{name}
		{...rest}
		id={rest.id ?? field?.id}
		aria-describedby={rest['aria-describedby'] ?? field?.describedBy}
		aria-invalid={field?.invalid || undefined}
		aria-required={rest['aria-required'] ?? (field?.required ? true : undefined)}
		class={boxClass(extra)}
	/>
{/snippet}

{#if label}
	<label class={cn('flex items-center gap-2 text-[13px] text-neutral-700 dark:text-neutral-200', klass)}>
		{@render box()}
		<span class="min-w-0">{label}</span>
	</label>
{:else}
	{@render box(klass)}
{/if}

<style>
	/* Check glyph — background image so the native input stays form-postable. */
	.ot-checkbox:checked {
		background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z'/%3e%3c/svg%3e");
		background-size: 100% 100%;
	}
</style>
