<script lang="ts">
	import { ChevronUp } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';

	type Props = {
		subjectType: 'ticket' | 'suggestion';
		id: string;
		count?: number;
		voted?: boolean;
		layout?: 'col' | 'row';
		/** Locked once the item is handled — public voting is disabled. */
		locked?: boolean;
	};
	let { subjectType, id, count = 0, voted = false, layout = 'col', locked = false }: Props = $props();

	let c = $state(count);
	let v = $state(voted);

	async function toggle(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		if (locked) return;
		v = !v;
		c += v ? 1 : -1;
		const res = await fetch(`/api/${subjectType}s/${id}/vote`, { method: 'POST' });
		if (res.ok) {
			const r = await res.json();
			v = r.voted;
			c = r.count;
		}
	}
</script>

<button
	type="button"
	onclick={toggle}
	disabled={locked}
	title={locked ? 'Voting is closed — this has been resolved' : undefined}
	class={cn(
		'flex items-center justify-center border font-semibold transition',
		layout === 'col' ? 'flex-col gap-0.5 rounded-lg px-3 py-1.5' : 'gap-1.5 rounded-full px-2.5 py-1 text-sm',
		locked
			? 'cursor-not-allowed border-neutral-200 text-neutral-300 dark:border-neutral-800 dark:text-neutral-600'
			: v
				? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10'
				: 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
	)}
>
	<ChevronUp size={layout === 'col' ? 18 : 14} />
	<span class={layout === 'col' ? 'text-sm' : ''}>{c}</span>
</button>
