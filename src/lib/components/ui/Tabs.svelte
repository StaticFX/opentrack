<script lang="ts" module>
	export type TabItem = { key: string; label: string; count?: number; href?: string };
</script>

<script lang="ts">
	import { cn } from '$lib/utils/cn';

	type Props = {
		items: TabItem[];
		/** Active key. Link mode reads it; state mode binds it. */
		value?: string;
		ariaLabel: string;
		onchange?: (key: string) => void;
		class?: string;
	};
	let { items, value = $bindable(), ariaLabel, onchange, class: klass }: Props = $props();

	// Link mode (every item navigates) renders <a> + aria-current; otherwise a
	// real tablist with roving tabindex and arrow-key selection.
	const linkMode = $derived(items.length > 0 && items.every((i) => i.href != null));
	const activeIdx = $derived(items.findIndex((i) => i.key === value));

	let listEl = $state<HTMLElement>();

	function select(key: string) {
		value = key;
		onchange?.(key);
	}

	function onKeydown(e: KeyboardEvent) {
		if (items.length === 0) return;
		const cur = activeIdx === -1 ? 0 : activeIdx;
		let next = -1;
		if (e.key === 'ArrowRight') next = (cur + 1) % items.length;
		else if (e.key === 'ArrowLeft') next = (cur - 1 + items.length) % items.length;
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = items.length - 1;
		if (next === -1) return;
		e.preventDefault();
		select(items[next].key);
		listEl?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
	}

	const tabClass = (active: boolean) =>
		cn(
			'focus-ring flex h-7 shrink-0 snap-start items-center gap-1.5 rounded-md px-2.5 text-[13px] whitespace-nowrap transition-colors duration-[90ms] motion-reduce:transition-none',
			active
				? 'bg-neutral-200/70 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
				: 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-300'
		);
	const listClass = $derived(
		cn('flex items-center gap-1 overflow-x-auto [scrollbar-width:none]', klass)
	);
</script>

{#snippet inner(item: TabItem)}
	<span class="truncate">{item.label}</span>
	{#if item.count != null}
		<span class="data-mono text-neutral-500 dark:text-neutral-400">{item.count}</span>
	{/if}
{/snippet}

{#if linkMode}
	<nav aria-label={ariaLabel} class={listClass}>
		{#each items as item (item.key)}
			{@const active = value != null && value === item.key}
			<a
				href={item.href}
				aria-current={active ? 'page' : undefined}
				class={tabClass(active)}
				onclick={() => select(item.key)}
			>
				{@render inner(item)}
			</a>
		{/each}
	</nav>
{:else}
	<!-- tabindex -1: focus lives on the tabs themselves (roving tabindex). -->
	<div
		bind:this={listEl}
		role="tablist"
		aria-label={ariaLabel}
		tabindex="-1"
		class={listClass}
		onkeydown={onKeydown}
	>
		{#each items as item, i (item.key)}
			{@const active = value === item.key}
			<button
				type="button"
				role="tab"
				aria-selected={active}
				tabindex={i === (activeIdx === -1 ? 0 : activeIdx) ? 0 : -1}
				class={tabClass(active)}
				onclick={() => select(item.key)}
			>
				{@render inner(item)}
			</button>
		{/each}
	</div>
{/if}
