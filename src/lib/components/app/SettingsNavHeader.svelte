<script lang="ts">
	import { ArrowLeft, Shield, UserRound } from '@lucide/svelte';

	// Shared header for the settings secondary sidebars (admin / workspace / project / account).
	// The `scope` eyebrow + entity badge make the current level unmistakable, so the
	// four otherwise near-identical sidebars can't be confused for one another.
	let {
		scope,
		title,
		backHref,
		backLabel,
		color = null,
		icon = null,
		avatarUrl = null
	}: {
		scope: 'instance' | 'workspace' | 'project' | 'account';
		title: string;
		backHref: string;
		backLabel: string;
		color?: string | null;
		icon?: string | null;
		avatarUrl?: string | null;
	} = $props();

	const eyebrow = { instance: 'Instance', workspace: 'Workspace', project: 'Project', account: 'Account' }[scope];
	const letter = $derived((title || '?').slice(0, 1).toUpperCase());
</script>

<div class="p-2">
	<a
		href={backHref}
		class="focus-ring flex items-center gap-2 rounded-[3px] px-2 py-1.5 text-sm text-[var(--dim)] transition-colors hover:bg-white/5 hover:text-[var(--text)]"
	>
		<ArrowLeft size={15} /> {backLabel}
	</a>
</div>

<div class="hairline-b flex items-center gap-2.5 px-3 pt-1 pb-3">
	{#if avatarUrl}
		<img src={avatarUrl} alt="" class={`size-8 shrink-0 object-cover ${scope === 'account' ? 'rounded-full' : 'rounded-[3px]'}`} />
	{:else if scope === 'instance'}
		<div class="grid size-8 shrink-0 place-items-center rounded-[3px] border border-[var(--rule)] bg-[var(--raised)] text-[var(--text)]">
			<Shield size={16} />
		</div>
	{:else if scope === 'account'}
		<div class="grid size-8 shrink-0 place-items-center rounded-full border border-[var(--rule)] bg-[var(--raised)] text-[var(--dim)]">
			<UserRound size={16} />
		</div>
	{:else}
		<div
			class="grid size-8 shrink-0 place-items-center rounded-[3px] text-sm font-bold text-white"
			style={`background:${color ?? 'var(--color-brand-600)'}`}
		>
			{#if icon}{icon}{:else}{letter}{/if}
		</div>
	{/if}
	<div class="min-w-0">
		<p class="text-[10px] font-semibold tracking-wider text-[var(--faint)] uppercase">{eyebrow} settings</p>
		<p class="mono-display truncate text-sm tracking-tight text-[var(--text)]">{title}</p>
	</div>
</div>
