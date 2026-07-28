<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	// Ghost cards + accent tile + display-face title: the shared "nothing here
	// yet, and that's an invitation" composition. Pure CSS, no assets.
	type Props = {
		icon: Component<{ size?: number | string }>;
		title: string;
		body?: string;
		children?: Snippet;
	};
	let { icon: Icon, title, body, children }: Props = $props();
</script>

<div class="relative mx-auto max-w-md px-8 py-14 text-center">
	<div class="pointer-events-none absolute inset-x-12 top-8 -z-10" aria-hidden="true">
		<div class="mx-auto h-16 w-52 -rotate-3 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700"></div>
		<div class="mx-auto -mt-12 h-16 w-52 rotate-2 rounded-2xl border border-dashed border-neutral-300/70 dark:border-neutral-700/70"></div>
	</div>
	<div
		class="mx-auto grid size-12 place-items-center rounded-2xl text-[var(--accent-fg)] shadow-sm"
		style="background:var(--accent-soft)"
	>
		<Icon size={24} />
	</div>
	<p class="type-poster mt-4 text-lg">{title}</p>
	{#if body}<p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{body}</p>{/if}
	{#if children}<div class="mt-4">{@render children()}</div>{/if}
</div>
