<script lang="ts">
	import { cn } from '$lib/utils/cn';

	let { keys, class: klass }: { keys: string[]; class?: string } = $props();
</script>

<span class={cn('inline-flex items-center gap-0.5 text-neutral-500 dark:text-neutral-400', klass)}>
	{#each keys as key, i (i)}
		<kbd
			class="hairline inline-flex h-4 min-w-4 items-center justify-center rounded-[4px] px-1 font-mono text-[10px] leading-none"
			>{key}</kbd
		>
	{/each}
</span>
