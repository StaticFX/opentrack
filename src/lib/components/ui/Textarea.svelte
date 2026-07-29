<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';
	import { getFieldContext } from './Field.svelte';

	type Props = { class?: string; value?: string } & HTMLTextareaAttributes;
	let { class: klass, value = $bindable(''), ...rest }: Props = $props();

	const field = getFieldContext();
	const invalid = $derived(
		field?.invalid || rest['aria-invalid'] === true || rest['aria-invalid'] === 'true'
	);
</script>

<textarea
	bind:value
	{...rest}
	id={rest.id ?? field?.id}
	aria-describedby={rest['aria-describedby'] ?? field?.describedBy}
	aria-invalid={invalid || undefined}
	aria-required={rest['aria-required'] ?? (field?.required ? true : undefined)}
	class={cn(
		'w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100',
		invalid &&
			'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/40 dark:border-red-500',
		klass
	)}
></textarea>
