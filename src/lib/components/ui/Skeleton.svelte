<script lang="ts">
	import { cn } from '$lib/utils/cn';

	type Props = { lines?: number; class?: string };
	let { lines = 3, class: klass }: Props = $props();

	// Nothing renders for the first 150ms — fast loads never see a flash.
	let show = $state(false);
	$effect(() => {
		const t = setTimeout(() => (show = true), 150);
		return () => clearTimeout(t);
	});
</script>

{#if show}
	<div class={cn('flex flex-col gap-2', klass)} role="status" aria-label="Loading">
		{#each Array.from({ length: lines }) as _, i (i)}
			<div
				class={cn(
					'h-3 animate-pulse rounded bg-neutral-200/80 motion-reduce:animate-none dark:bg-neutral-800',
					i === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full'
				)}
			></div>
		{/each}
	</div>
{/if}
