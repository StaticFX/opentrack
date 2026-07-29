<script module lang="ts">
	export type FilterOption = { value: string; label: string; color?: string };
	/** `field: true` → the section's values live under `filters.fields[id]` rather than `filters[id]`. */
	export type FilterSection = { id: string; label: string; options: FilterOption[]; field?: boolean };
</script>

<script lang="ts">
	import { ListFilter, Check, X } from '@lucide/svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import type { BoardFilters } from '$lib/board';
	import { filterCount } from '$lib/board';
	import Popover from '$lib/components/ui/Popover.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { cn } from '$lib/utils/cn';

	type Props = {
		filters: BoardFilters;
		sections: FilterSection[];
		onclear: () => void;
	};
	let { filters = $bindable(), sections, onclear }: Props = $props();

	let open = $state(false);
	// Desktop anchors a Popover next to the trigger; below `sm` it's a bottom Sheet.
	const desktop = new MediaQuery('(min-width: 640px)');
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

	const triggerClass = cn(
		'focus-ring hit flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
		'border-[var(--ot-hairline)] text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
	);
	const triggerActiveClass =
		'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-fg)] hover:bg-[var(--accent-soft)]';
</script>

{#snippet body()}
	<div class="hairline-b flex items-center justify-between px-3 py-2">
		<span class="pub-label">Filters</span>
		{#if count}
			<button
				type="button"
				onclick={onclear}
				class="focus-ring flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
			>
				<X size={12} /> Clear all
			</button>
		{/if}
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
					class="focus-ring flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
				>
					<span
						class={cn(
							'grid size-4 shrink-0 place-items-center rounded border transition-colors',
							on ? 'border-[var(--accent-solid)] bg-[var(--accent-solid)] text-white' : 'border-neutral-300 dark:border-neutral-600'
						)}
					>
						{#if on}<Check size={12} />{/if}
					</span>
					{#if opt.color}<span class="size-2.5 shrink-0 rounded-full" style={`background:${opt.color}`}></span>{/if}
					<span class="min-w-0 flex-1 truncate">{opt.label}</span>
				</button>
			{/each}
		{:else}
			<p class="px-2 py-3 text-xs text-neutral-500">Nothing to filter on yet.</p>
		{/each}
	</div>
{/snippet}

{#if desktop.current}
	<Popover bind:open placement="bottom-start" class="flex max-h-[70vh] w-72 flex-col overflow-hidden p-0">
		{#snippet trigger(tp)}
			<button type="button" {...tp} class={cn(triggerClass, count > 0 && triggerActiveClass)} title="Filter tickets">
				<ListFilter size={13} /> Filter
				{#if count}<span class="data-mono grid size-4 place-items-center rounded-full bg-[var(--accent-solid)] text-[10px] font-semibold text-white">{count}</span>{/if}
			</button>
		{/snippet}
		{#snippet content()}{@render body()}{/snippet}
	</Popover>
{:else}
	<button type="button" onclick={() => (open = true)} class={cn(triggerClass, count > 0 && triggerActiveClass)} title="Filter tickets">
		<ListFilter size={13} /> Filter
		{#if count}<span class="data-mono grid size-4 place-items-center rounded-full bg-[var(--accent-solid)] text-[10px] font-semibold text-white">{count}</span>{/if}
	</button>
	<Sheet bind:open side="bottom" size="md" ariaLabel="Filters" class="flex max-h-[75vh] flex-col p-0">
		{@render body()}
	</Sheet>
{/if}
