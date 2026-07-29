<script lang="ts">
	import { ago } from '$lib/time';
	import Tooltip from './Tooltip.svelte';
	import { cn } from '$lib/utils/cn';

	type Props = {
		date: string | Date;
		/** Relabel interval in seconds; 0 disables. */
		refresh?: number;
		class?: string;
	};
	let { date, refresh = 60, class: klass }: Props = $props();

	let now = $state(Date.now());

	$effect(() => {
		if (refresh <= 0) return;
		const t = setInterval(() => (now = Date.now()), refresh * 1000);
		return () => clearInterval(t);
	});

	const d = $derived(new Date(date));
	const valid = $derived(!Number.isNaN(d.getTime()));

	/** Compact future-relative label ("in 3d", "in 2w"); ago() covers the past. */
	function inFuture(ms: number): string {
		const s = Math.floor(ms / 1000);
		if (s < 3600) return `in ${Math.max(1, Math.floor(s / 60))}m`;
		if (s < 86400) return `in ${Math.floor(s / 3600)}h`;
		if (s < 604800) return `in ${Math.floor(s / 86400)}d`;
		if (s < 4838400) return `in ${Math.floor(s / 604800)}w`;
		return d.toLocaleDateString();
	}

	const label = $derived.by(() => {
		if (!valid) return '—';
		const diff = d.getTime() - now;
		return diff > 30_000 ? inFuture(diff) : ago(d);
	});
	const absolute = $derived(
		valid ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''
	);
</script>

{#if valid}
	<Tooltip label={absolute}>
		<time
			datetime={d.toISOString()}
			class={cn('data-mono whitespace-nowrap text-neutral-500 dark:text-neutral-400', klass)}
			>{label}</time
		>
	</Tooltip>
{:else}
	<span class={cn('data-mono text-neutral-500 dark:text-neutral-400', klass)}>—</span>
{/if}
