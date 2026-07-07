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
	class="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-2.5 dark:border-neutral-800"
>
	<div class="flex min-w-0 items-center gap-2">
		<span class="size-3 shrink-0 rounded-full" style={`background:${project?.color ?? '#9ca3af'}`}></span>
		<h1 class="truncate text-sm font-semibold">{project?.name ?? ''}</h1>
		{#if project?.visibility === 'private'}
			<Lock size={13} class="shrink-0 text-neutral-400" />
		{:else if project?.visibility === 'public'}
			<Globe size={13} class="shrink-0 text-neutral-400" />
		{/if}
		<span class="text-neutral-300 dark:text-neutral-700">/</span>
		<span class="truncate text-sm text-neutral-500">{section}</span>
	</div>
	{#if action}
		<div class="flex shrink-0 items-center gap-2">{@render action()}</div>
	{/if}
</header>
