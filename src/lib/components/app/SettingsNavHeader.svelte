<script lang="ts">
	import { ArrowLeft, Shield } from '@lucide/svelte';

	// Shared header for the settings secondary sidebars (admin / workspace / project).
	// The `scope` eyebrow + entity badge make the current level unmistakable, so the
	// three otherwise near-identical sidebars can't be confused for one another.
	let {
		scope,
		title,
		backHref,
		backLabel,
		color = null,
		icon = null,
		avatarUrl = null
	}: {
		scope: 'instance' | 'workspace' | 'project';
		title: string;
		backHref: string;
		backLabel: string;
		color?: string | null;
		icon?: string | null;
		avatarUrl?: string | null;
	} = $props();

	const eyebrow = { instance: 'Instance', workspace: 'Workspace', project: 'Project' }[scope];
	const letter = $derived((title || '?').slice(0, 1).toUpperCase());
</script>

<div class="p-2">
	<a
		href={backHref}
		class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
	>
		<ArrowLeft size={15} /> {backLabel}
	</a>
</div>

<div class="flex items-center gap-2.5 border-b border-neutral-200 px-3 pt-1 pb-3 dark:border-neutral-800">
	{#if avatarUrl}
		<img src={avatarUrl} alt="" class="size-8 shrink-0 rounded-md object-cover" />
	{:else if scope === 'instance'}
		<div class="grid size-8 shrink-0 place-items-center rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900">
			<Shield size={16} />
		</div>
	{:else}
		<div
			class="grid size-8 shrink-0 place-items-center rounded-md text-sm font-bold text-white"
			style={`background:${color ?? 'var(--color-brand-600)'}`}
		>
			{#if icon}{icon}{:else}{letter}{/if}
		</div>
	{/if}
	<div class="min-w-0">
		<p class="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">{eyebrow} settings</p>
		<p class="truncate text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">{title}</p>
	</div>
</div>
