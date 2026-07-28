<script lang="ts">
	import { ChevronUp } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import { announce } from '$lib/announce';
	import { cn } from '$lib/utils/cn';

	type Props = {
		subjectType: 'ticket' | 'suggestion';
		id: string;
		count?: number;
		voted?: boolean;
		layout?: 'col' | 'row';
		/** Locked once the item is handled — public voting is disabled. */
		locked?: boolean;
		/** Called after a successful vote toggle with the confirmed state. */
		onvote?: (voted: boolean, count: number) => void;
	};
	let { subjectType, id, count = 0, voted = false, layout = 'col', locked = false, onvote }: Props = $props();

	let c = $state(count);
	let v = $state(voted);
	// Reconcile with fresh server props (live-invalidate reloads, param navs).
	$effect(() => {
		c = count;
		v = voted;
	});
	let pop = $state(false);
	let sparks = $state(0);
	let seq = 0;

	const motionOK = () =>
		typeof matchMedia !== 'undefined' && !matchMedia('(prefers-reduced-motion: reduce)').matches;

	async function toggle(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		if (locked) return;
		const prev = { c, v };
		v = !v;
		c += v ? 1 : -1;
		if (v && motionOK()) {
			pop = false;
			sparks++;
			requestAnimationFrame(() => (pop = true));
		}
		const my = ++seq;
		try {
			const res = await fetch(`/api/${subjectType}s/${id}/vote`, { method: 'POST' });
			if (my !== seq) return; // a newer click's response supersedes this one
			if (res.ok) {
				const r = await res.json();
				v = r.voted;
				c = r.count;
				announce(v ? `Vote added — ${c} total` : `Vote removed — ${c} total`);
				onvote?.(v, c);
			} else {
				v = prev.v;
				c = prev.c;
				announce('Vote failed — try again in a moment');
			}
		} catch {
			if (my === seq) {
				v = prev.v;
				c = prev.c;
			}
		}
	}
</script>

<button
	type="button"
	onclick={toggle}
	disabled={locked}
	aria-pressed={v}
	title={locked ? 'Voting is closed — this has been resolved' : v ? 'Remove your vote' : 'Upvote'}
	class={cn(
		'relative flex items-center justify-center border font-semibold transition-all duration-150',
		layout === 'col' ? 'flex-col gap-0 rounded-xl px-3 py-2' : 'gap-1.5 rounded-full px-2.5 py-1 text-sm',
		locked
			? 'cursor-not-allowed border-neutral-200 text-neutral-300 dark:border-neutral-700/60 dark:text-neutral-600'
			: v
				? 'border-[var(--accent-border)] text-[var(--accent-fg)] shadow-[0_2px_10px_-2px_var(--accent-glow)]'
				: 'border-black/10 bg-white text-neutral-600 shadow-sm hover:-translate-y-0.5 hover:border-[var(--accent-border)] hover:text-[var(--accent-fg)] hover:shadow-md active:scale-[0.97] dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300'
	)}
	style={!locked && v ? 'background:linear-gradient(to bottom, var(--accent-soft), var(--accent-wash))' : ''}
>
	{#if sparks > 0}
		{#key sparks}
			<span class="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
				{#each [0, 60, 120, 180, 240, 300] as a (a)}
					<span
						class="ot-spark absolute h-2 w-0.5 rounded-full"
						style={`--a:${a}deg;background:var(--accent-solid)`}
					></span>
				{/each}
			</span>
		{/key}
	{/if}

	<span class={pop ? 'ot-pop' : ''} onanimationend={() => (pop = false)}>
		<ChevronUp size={layout === 'col' ? 18 : 14} />
	</span>
	<!-- Odometer count: mono keeps the width stable while digits roll. -->
	<span
		class={cn(
			'relative inline-grid overflow-hidden font-mono tabular-nums',
			layout === 'col' ? 'text-sm' : ''
		)}
	>
		{#key c}
			<span
				class="col-start-1 row-start-1"
				in:fly={{ y: 9, duration: motionOK() ? 180 : 0 }}
				out:fly={{ y: -9, duration: motionOK() ? 180 : 0 }}>{c}</span
			>
		{/key}
	</span>
</button>
