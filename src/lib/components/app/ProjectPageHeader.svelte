<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { Lock, Globe } from '@lucide/svelte';

	// Shared top header bar for every internal project page (Overview, Board,
	// Milestones, Releases, Activity, Analytics) so the chrome stays put when
	// switching sections. Reads the project from page.data (provided globally by
	// the project layout); an optional `action` snippet renders on the right.
	let {
		section,
		action
	}: { section: string; action?: Snippet } = $props();

	const project = $derived(
		page.data.project as { name: string; color?: string | null; visibility?: string } | undefined
	);
</script>

<header
	class="flex items-center justify-between gap-3 border-b border-black/5 px-5 py-3 dark:border-white/8"
>
	<div class="flex min-w-0 items-center gap-2.5">
		<span
			class="size-2.5 shrink-0 rounded-full"
			style={`background:var(--accent);box-shadow:0 0 0 3px var(--accent-soft), 0 0 10px var(--accent-glow)`}
		></span>
		<h1 class="truncate font-display text-[15px] font-semibold tracking-tight">{project?.name ?? ''}</h1>
		{#if project?.visibility === 'private'}
			<Lock size={13} class="shrink-0 text-neutral-400" />
		{:else if project?.visibility === 'public'}
			<Globe size={13} class="shrink-0 text-neutral-400" />
		{/if}
		<span class="text-neutral-300 dark:text-neutral-600">/</span>
		<span class="truncate text-sm text-neutral-500 dark:text-neutral-400">{section}</span>
	</div>
	{#if action}
		<div class="flex shrink-0 items-center gap-2">{@render action()}</div>
	{/if}
</header>
