<script lang="ts" module>
	import { getContext, setContext } from 'svelte';

	export type FieldContext = {
		readonly id: string;
		readonly describedBy: string | undefined;
		readonly invalid: boolean;
		readonly required: boolean;
	};

	const KEY = Symbol('ot-field');

	/** Child controls (Input/Select/Textarea/Checkbox) self-associate via this. */
	export function getFieldContext(): FieldContext | undefined {
		return getContext(KEY);
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		label: string;
		hint?: string;
		error?: string;
		required?: boolean;
		for?: string;
		children: Snippet;
	};
	let { label, hint, error, required = false, for: htmlFor, children }: Props = $props();

	const autoId = $props.id();
	// An explicit `for` wins so call sites that wired their own ids keep working.
	const id = $derived(htmlFor ?? `${autoId}-field`);
	const describedBy = $derived(error ? `${id}-error` : hint ? `${id}-hint` : undefined);

	setContext<FieldContext>(KEY, {
		get id() {
			return id;
		},
		get describedBy() {
			return describedBy;
		},
		get invalid() {
			return Boolean(error);
		},
		get required() {
			return required;
		}
	});
</script>

<div class="flex flex-col gap-1.5">
	<label for={id} class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
		{label}{#if required}<span class="ml-0.5 text-red-600 dark:text-red-400" aria-hidden="true">*</span>{/if}
	</label>
	{@render children()}
	{#if error}
		<p id={`${id}-error`} class="text-xs text-red-600">{error}</p>
	{:else if hint}
		<p id={`${id}-hint`} class="text-xs text-neutral-500">{hint}</p>
	{/if}
</div>
