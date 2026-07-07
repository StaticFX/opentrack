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
		class={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm ${count ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
		title="Filter tickets"
	>
		<ListFilter size={14} /> Filter
		{#if count}<span class="grid size-4 place-items-center rounded-full bg-brand-600 text-[10px] font-semibold text-white">{count}</span>{/if}
	</button>

	{#if open}
		<!-- Mobile: dim backdrop behind the bottom sheet. Desktop: no backdrop. -->
		<div class="fixed inset-0 z-30 bg-neutral-950/40 sm:hidden"></div>
		<div
			use:clickOutside={() => (open = false)}
			class="absolute left-0 top-full z-40 mt-1 flex max-h-[70vh] w-72 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:mt-0 max-sm:max-h-[75vh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-0 max-sm:border-t max-sm:shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
		>
			<!-- Grab-handle affordance (mobile sheet only). -->
			<div class="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-neutral-300 sm:hidden dark:bg-neutral-700"></div>
			<div class="flex items-center justify-between border-b border-neutral-100 px-3 py-2 dark:border-neutral-800">
				<span class="text-xs font-semibold text-neutral-500">Filters</span>
				<div class="flex items-center gap-1">
					{#if count}
						<button onclick={onclear} class="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"><X size={12} /> Clear all</button>
					{/if}
					<button onclick={() => (open = false)} class="rounded p-1 text-neutral-400 hover:bg-neutral-100 sm:hidden dark:hover:bg-neutral-800" aria-label="Close"><X size={16} /></button>
				</div>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto p-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
				{#each visible as section (section.id)}
					{@const sel = selected(section)}
					<div class="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">{section.label}</div>
					{#each section.options as opt (opt.value)}
						{@const on = sel.includes(opt.value)}
						<button
							type="button"
							onclick={() => toggle(section, opt.value)}
							class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
						>
							<span class={`grid size-4 shrink-0 place-items-center rounded border ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
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
