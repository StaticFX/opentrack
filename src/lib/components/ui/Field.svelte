<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		label: string;
		hint?: string;
		error?: string;
		for?: string;
		children: Snippet;
	};
	let { label, hint, error, for: htmlFor, children }: Props = $props();
</script>

<div class="flex flex-col gap-1.5">
	<label for={htmlFor} class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
		{label}
	</label>
	{@render children()}
	{#if error}
		<p class="text-xs text-red-600">{error}</p>
	{:else if hint}
		<p class="text-xs text-neutral-500">{hint}</p>
	{/if}
</div>
