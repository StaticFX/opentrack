<script module lang="ts">
	export type FilterOption = { value: string; label: string; color?: string };
	/** `field: true` → the section's values live under `filters.fields[id]` rather than `filters[id]`. */
	export type FilterSection = { id: string; label: string; options: FilterOption[]; field?: boolean };
</script>

<script lang="ts">
	import { ListFilter, Check, X } from '@lucide/svelte';
	import { clickOutside } from '$lib/utils/clickOutside';
	import type { BoardFilters } from '$lib/board';
	import { filterCount } from '$lib/board';

	type Props = {
		filters: BoardFilters;
		sections: FilterSection[];
		onclear: () => void;
	};
	let { filters = $bindable(), sections, onclear }: Props = $props();

	let open = $state(false);
	const visible = $derived(sections.filter((s) => s.options.length > 0));
	const count = $derived(filterCount(filters));

	function selected(s: FilterSection): string[] {
		return (s.field ? filters.fields?.[s.id] : (filters[s.id as keyof BoardFilters] as string[])) ?? [];
	}
	function toggle(s: FilterSection, value: string) {
		const cur = selected(s);
		const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
		filters = s.field
			? { ...filters, fields: { ...(filters.fields ?? {}), [s.id]: next } }
			: { ...filters, [s.id]: next };
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => (open = !open)}
		class={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${count ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-fg)]' : 'border-black/5 bg-white/70 text-neutral-500 hover:text-neutral-800 dark:border-white/5 dark:bg-neutral-800/70 dark:text-neutral-400 dark:hover:text-neutral-200'}`}
		title="Filter tickets"
	>
		<ListFilter size={13} /> Filter
		{#if count}<span class="grid size-4 place-items-center rounded-full bg-[var(--accent-solid)] font-mono text-[10px] font-semibold text-white tabular-nums">{count}</span>{/if}
	</button>

	{#if open}
		<!-- Mobile: dim backdrop behind the bottom sheet. Desktop: no backdrop. -->
		<div class="fixed inset-0 z-30 bg-neutral-950/40 sm:hidden"></div>
		<div
			use:clickOutside={() => (open = false)}
			class="absolute left-0 top-full z-40 mt-1.5 flex max-h-[70vh] w-72 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-xl max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:mt-0 max-sm:max-h-[75vh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-0 max-sm:border-t max-sm:shadow-2xl dark:border-white/8 dark:bg-neutral-800"
		>
			<!-- Grab-handle affordance (mobile sheet only). -->
			<div class="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-neutral-300 sm:hidden dark:bg-neutral-600"></div>
			<div class="flex items-center justify-between border-b border-black/5 px-3 py-2 dark:border-white/8">
				<span class="pub-label">Filters</span>
				<div class="flex items-center gap-1">
					{#if count}
						<button onclick={onclear} class="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200"><X size={12} /> Clear all</button>
					{/if}
					<button onclick={() => (open = false)} class="rounded-md p-1 text-neutral-400 transition-colors hover:bg-black/5 sm:hidden dark:hover:bg-white/10" aria-label="Close"><X size={16} /></button>
				</div>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto p-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
				{#each visible as section (section.id)}
					{@const sel = selected(section)}
					<div class="pub-label px-2 pt-2.5 pb-1">{section.label}</div>
					{#each section.options as opt (opt.value)}
						{@const on = sel.includes(opt.value)}
						<button
							type="button"
							onclick={() => toggle(section, opt.value)}
							class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
						>
							<span class={`grid size-4 shrink-0 place-items-center rounded border transition-colors ${on ? 'border-[var(--accent-solid)] bg-[var(--accent-solid)] text-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
								{#if on}<Check size={12} />{/if}
							</span>
							{#if opt.color}<span class="size-2.5 shrink-0 rounded-full" style={`background:${opt.color}`}></span>{/if}
							<span class="min-w-0 flex-1 truncate">{opt.label}</span>
						</button>
					{/each}
				{:else}
					<p class="px-2 py-3 text-xs text-neutral-400">Nothing to filter on yet.</p>
				{/each}
			</div>
		</div>
	{/if}
</div>
