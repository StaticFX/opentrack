<script lang="ts">
	import { SmilePlus } from '@lucide/svelte';
	import { clickOutside } from '$lib/utils/clickOutside';
	import { REACTION_EMOJI, type ReactionSummary } from '$lib/reactions';

	type Props = {
		subjectType: 'ticket' | 'suggestion' | 'comment';
		subjectId: string;
		reactions?: ReactionSummary[];
		canReact?: boolean;
		size?: 'sm' | 'md';
	};
	let { subjectType, subjectId, reactions = [], canReact = true, size = 'md' }: Props = $props();

	let items = $state<ReactionSummary[]>(reactions);
	let pickerOpen = $state(false);
	$effect(() => { items = reactions; });

	async function react(emoji: string) {
		pickerOpen = false;
		if (!canReact) return;
		const res = await fetch('/api/reactions', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ subjectType, subjectId, emoji })
		});
		if (res.ok) items = (await res.json()).reactions;
	}

	const pad = $derived(size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs');
</script>

<div class="flex flex-wrap items-center gap-1">
	{#each items as r (r.emoji)}
		<button
			onclick={() => react(r.emoji)}
			disabled={!canReact}
			class={`flex items-center gap-1 rounded-full border ${pad} ${r.reacted ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'} disabled:opacity-60`}
			title={r.reacted ? 'Remove reaction' : 'React'}
		>
			<span>{r.emoji}</span><span class="font-medium">{r.count}</span>
		</button>
	{/each}

	{#if canReact}
		<div class="relative">
			<button
				onclick={() => (pickerOpen = !pickerOpen)}
				class={`flex items-center rounded-full border border-neutral-200 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:border-neutral-700 dark:hover:bg-neutral-800 ${size === 'sm' ? 'p-1' : 'p-1.5'}`}
				aria-label="Add reaction"
			>
				<SmilePlus size={size === 'sm' ? 13 : 15} />
			</button>
			{#if pickerOpen}
				<div
					use:clickOutside={() => (pickerOpen = false)}
					class="absolute bottom-full left-0 z-30 mb-1 flex gap-0.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
				>
					{#each REACTION_EMOJI as e (e)}
						<button onclick={() => react(e)} class="rounded-md px-1.5 py-1 text-base hover:bg-neutral-100 dark:hover:bg-neutral-800">{e}</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
