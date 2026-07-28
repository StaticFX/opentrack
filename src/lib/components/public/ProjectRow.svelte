<script lang="ts">
	// A directory row: identity + one line of truth about the project's pulse.
	// Wrapped in its own accent scope so the mark/sparkline speak the project's
	// colour while the page chrome stays instance-branded.
	import { ago } from '$lib/time';
	import Sparkline from './Sparkline.svelte';

	type Props = {
		href: string;
		name: string;
		description: string | null;
		icon: string | null;
		color: string | null;
		stats: {
			open: number;
			shipped: number;
			weekly: Array<{ label: string; opened: number; closed: number }>;
			lastActivityAt: Date | string | null;
		};
	};
	let { href, name, description, icon, color, stats }: Props = $props();

	const values = $derived(stats.weekly.map((w) => w.opened + w.closed));
</script>

<a
	{href}
	class="accent-scope pub-card group flex items-center gap-3.5 p-3.5 transition duration-150 hover:-translate-y-0.5 active:scale-[0.99] sm:gap-4 sm:p-4"
	style={`--accent:${color || 'var(--color-brand-600)'}`}
>
	<span
		class="grid size-10 shrink-0 place-items-center rounded-xl text-lg font-bold text-white shadow-sm"
		style="background:linear-gradient(140deg, color-mix(in oklab, var(--accent) 86%, white), var(--accent))"
	>
		{#if icon}{icon}{:else}{name.slice(0, 1).toUpperCase()}{/if}
	</span>

	<span class="min-w-0 flex-1">
		<span class="block truncate font-display font-semibold tracking-tight group-hover:text-[var(--accent-fg)]">{name}</span>
		{#if description}
			<span class="mt-0.5 block truncate text-sm text-neutral-500 dark:text-neutral-400">{description}</span>
		{/if}
	</span>

	<span class="hidden shrink-0 sm:block">
		<Sparkline {values} />
	</span>

	<span class="shrink-0 text-right font-mono text-[11px] leading-relaxed text-neutral-400 dark:text-neutral-500">
		<span class="block"><span class="font-semibold text-[var(--accent-fg)]">{stats.open}</span> open · {stats.shipped} shipped</span>
		<span class="block">{stats.lastActivityAt ? `active ${ago(stats.lastActivityAt)}` : 'quiet lately'}</span>
	</span>
</a>
