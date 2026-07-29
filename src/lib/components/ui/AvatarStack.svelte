<script lang="ts">
	import Avatar from './Avatar.svelte';
	import { cn } from '$lib/utils/cn';

	type Size = 16 | 20 | 24 | 32;
	type Props = {
		users: { name: string; src?: string | null }[];
		max?: number;
		size?: Size;
		class?: string;
	};
	let { users, max = 3, size = 20, class: klass }: Props = $props();

	const shown = $derived(users.slice(0, max));
	const extra = $derived(users.length - shown.length);

	const OVERLAP: Record<Size, string> = {
		16: '-space-x-1',
		20: '-space-x-1',
		24: '-space-x-1.5',
		32: '-space-x-2'
	};
	const CHIP: Record<Size, string> = {
		16: 'h-4 min-w-4',
		20: 'h-5 min-w-5',
		24: 'h-6 min-w-6',
		32: 'h-8 min-w-8'
	};
</script>

{#if users.length > 0}
	<span class={cn('inline-flex items-center', OVERLAP[size], klass)}>
		{#each shown as user, i (`${user.name}-${i}`)}
			<Avatar
				name={user.name}
				src={user.src}
				{size}
				class="ring-1 ring-white dark:ring-neutral-900"
			/>
		{/each}
		{#if extra > 0}
			<span
				class={cn(
					'data-mono inline-flex shrink-0 items-center justify-center rounded-full bg-neutral-100 px-1 leading-none text-neutral-600 ring-1 ring-white dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-900',
					CHIP[size]
				)}>+{extra}</span
			>
		{/if}
	</span>
{/if}
