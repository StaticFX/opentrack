<script lang="ts">
	import { tick } from 'svelte';
	import { Check, ChevronDown } from '@lucide/svelte';
	import { clickOutside } from '$lib/utils/clickOutside';
	import { cn } from '$lib/utils/cn';
	import { getFieldContext } from './Field.svelte';

	type Option = { value: string; label: string; color?: string };
	type Props = {
		value?: string;
		options: Option[];
		onchange?: (value: string) => void;
		/** Renders a hidden input so the value posts inside a <form>. */
		name?: string;
		/** Submit the enclosing form when the value changes. */
		autosubmit?: boolean;
		placeholder?: string;
		disabled?: boolean;
		class?: string;
		size?: 'sm' | 'md';
	};
	let {
		value = $bindable(''),
		options,
		onchange,
		name,
		autosubmit = false,
		placeholder = 'Select…',
		disabled = false,
		class: klass,
		size = 'md'
	}: Props = $props();

	const field = getFieldContext();
	const uid = $props.id();
	const listboxId = `${uid}-listbox`;
	const optionId = (i: number) => `${uid}-opt-${i}`;

	let open = $state(false);
	let active = $state(-1);
	let placeAbove = $state(false);
	let hidden = $state<HTMLInputElement | undefined>();
	let triggerEl = $state<HTMLButtonElement | undefined>();
	let listEl = $state<HTMLDivElement | undefined>();

	const current = $derived(options.find((o) => o.value === value));
	const invalid = $derived(field?.invalid ?? false);

	function openList() {
		if (disabled || open || options.length === 0) return;
		placeAbove = false;
		open = true;
		const sel = options.findIndex((o) => o.value === value);
		active = sel >= 0 ? sel : 0;
	}

	function closeList() {
		open = false;
		active = -1;
	}

	async function choose(v: string) {
		value = v;
		closeList();
		onchange?.(v);
		if (autosubmit) {
			await tick();
			hidden?.form?.requestSubmit();
		}
	}

	// Flip below→above when the popup would clip the viewport bottom; keep the
	// active option scrolled into view while the user arrows through.
	$effect(() => {
		if (!open || !triggerEl || !listEl) return;
		const r = triggerEl.getBoundingClientRect();
		const h = listEl.offsetHeight;
		placeAbove = r.bottom + h + 8 > window.innerHeight && r.top - h - 8 > 0;
	});
	$effect(() => {
		if (open && active >= 0 && listEl) {
			document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
		}
	});

	let typed = '';
	let typedAt = 0;
	function typeahead(ch: string) {
		const now = Date.now();
		if (now - typedAt > 500) typed = '';
		typedAt = now;
		typed += ch.toLowerCase();
		// Single repeated char cycles; longer buffers match from the active row.
		const from = typed.length === 1 ? (active + 1) % options.length : Math.max(active, 0);
		for (let k = 0; k < options.length; k++) {
			const i = (from + k) % options.length;
			if (options[i].label.toLowerCase().startsWith(typed)) {
				active = i;
				return;
			}
		}
	}

	function onTriggerKeydown(e: KeyboardEvent) {
		if (disabled) return;
		const printable = e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey;
		if (!open) {
			if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End'].includes(e.key)) {
				e.preventDefault();
				openList();
				if (e.key === 'Home') active = 0;
				if (e.key === 'End') active = options.length - 1;
			} else if (printable) {
				e.preventDefault();
				openList();
				typeahead(e.key);
			}
			return;
		}
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				active = Math.min(active + 1, options.length - 1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				active = Math.max(active - 1, 0);
				break;
			case 'Home':
				e.preventDefault();
				active = 0;
				break;
			case 'End':
				e.preventDefault();
				active = options.length - 1;
				break;
			case 'Enter':
			case ' ':
				e.preventDefault();
				if (options[active]) choose(options[active].value);
				break;
			case 'Escape':
				// Consume so a wrapping Dialog/modal Esc handler doesn't also fire.
				e.preventDefault();
				e.stopPropagation();
				closeList();
				break;
			case 'Tab':
				closeList();
				break;
			default:
				if (printable) {
					e.preventDefault();
					typeahead(e.key);
				}
		}
	}

	const trigger = $derived(size === 'sm' ? 'h-7 px-2 text-xs' : 'h-9 px-2.5 text-sm');
</script>

<div class={cn('relative', klass)} use:clickOutside={() => open && closeList()}>
	{#if name}<input type="hidden" {name} {value} bind:this={hidden} />{/if}
	<button
		type="button"
		{disabled}
		bind:this={triggerEl}
		id={field?.id}
		role="combobox"
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls={open ? listboxId : undefined}
		aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
		aria-describedby={field?.describedBy}
		aria-invalid={invalid || undefined}
		aria-required={field?.required ? true : undefined}
		onclick={() => (open ? closeList() : openList())}
		onkeydown={onTriggerKeydown}
		class={cn(
			'focus-ring flex w-full items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white text-left text-neutral-800 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800',
			invalid && 'border-red-500 dark:border-red-500',
			trigger
		)}
	>
		<span class="flex min-w-0 items-center gap-1.5 truncate">
			{#if current?.color}<span class="size-2.5 shrink-0 rounded-full" style={`background:${current.color}`}></span>{/if}
			<span class={cn('truncate', !current && 'text-neutral-400')}>{current?.label ?? placeholder}</span>
		</span>
		<ChevronDown size={14} class="shrink-0 text-neutral-400" />
	</button>

	{#if open}
		<div
			bind:this={listEl}
			id={listboxId}
			role="listbox"
			tabindex="-1"
			onmousedown={(e) => e.preventDefault()}
			class={cn(
				'ot-select-pop absolute z-30 max-h-60 w-full min-w-max overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900',
				placeAbove ? 'bottom-full mb-1' : 'top-full mt-1'
			)}
		>
			{#each options as o, i (o.value)}
				<!-- tabindex -1 + mousedown-preventDefault above: focus stays on the
				     trigger (aria-activedescendant pattern). -->
				<button
					type="button"
					id={optionId(i)}
					role="option"
					tabindex={-1}
					aria-selected={o.value === value}
					onclick={() => choose(o.value)}
					onmouseenter={() => (active = i)}
					class={cn(
						'flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
						i === active && 'bg-neutral-100 dark:bg-neutral-800'
					)}
				>
					{#if o.color}<span class="size-2.5 shrink-0 rounded-full" style={`background:${o.color}`}></span>{/if}
					<span class="flex-1 truncate">{o.label}</span>
					{#if o.value === value}<Check size={14} class="text-brand-600" />{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.ot-select-pop {
		animation: pop-in 120ms var(--ease-out-quint);
	}
	@keyframes pop-in {
		from {
			opacity: 0;
			transform: scale(0.98);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ot-select-pop {
			animation: none;
		}
	}
</style>
