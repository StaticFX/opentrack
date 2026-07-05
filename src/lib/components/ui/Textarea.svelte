<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	type Props = { class?: string; value?: string } & HTMLTextareaAttributes;
	let { class: klass, value = $bindable(''), ...rest }: Props = $props();
</script>

<textarea
	bind:value
	class={cn(
		'w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100',
		klass
	)}
	{...rest}
></textarea>
