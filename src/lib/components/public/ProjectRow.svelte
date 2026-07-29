<script lang="ts">
	// A directory row, mono: identity + one line of truth about the project's
	// pulse, separated by a hairline. Type on the ground — no card, no gradient.
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

	const ACTIVE_WINDOW_MS = 48 * 60 * 60 * 1000;
	const active = $derived(
		stats.lastActivityAt != null &&
			Date.now() - new Date(stats.lastActivityAt).getTime() < ACTIVE_WINDOW_MS
	);
	// Colour survives as a faint per-project identity mark, not a fill/wash.
	const mark = $derived(color || 'var(--accent)');
</script>

<a
	{href}
	class="mono-focus group flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--rule)] py-3.5"
>
	<span class="flex shrink-0 items-baseline gap-1.5">
		{#if active}
			<span class="live-dot inline-block size-1.5 rounded-full" title="Active in the last 48h" aria-hidden="true"></span>
		{/if}
		{#if icon}
			<span aria-hidden="true">{icon}</span>
		{:else}
			<span class="tabular-nums" style={`color:${mark}`} aria-hidden="true">#</span>
		{/if}
		<span class="text-[15px] tracking-tight text-[var(--text)] transition-colors group-hover:text-[var(--accent)]">{name}</span>
	</span>

	{#if description}
		<span class="min-w-0 flex-1 truncate text-[12px] text-[var(--dim)]">— {description}</span>
	{:else}
		<span class="flex-1"></span>
	{/if}

	<span class="hidden shrink-0 text-[var(--faint)] sm:block">
		<Sparkline {values} />
	</span>

	<span class="shrink-0 text-[11px] tabular-nums text-[var(--faint)]">
		<span class="text-[var(--dim)]">{stats.open}</span> open ·
		<span class="text-[var(--dim)]">{stats.shipped}</span> shipped ·
		{stats.lastActivityAt ? `active ${ago(stats.lastActivityAt)}` : 'quiet lately'} →
	</span>
</a>

<style>
	.live-dot {
		background: var(--accent);
	}
	@media (prefers-reduced-motion: no-preference) {
		.live-dot {
			animation: mono-dot 1.9s ease-in-out infinite;
		}
	}
	@keyframes mono-dot {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
