<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from '@lucide/svelte';

	type Props = {
		open?: boolean;
		title: string;
		description?: string;
		children?: Snippet;
		footer?: Snippet;
	};
	let { open = $bindable(false), title, description, children, footer }: Props = $props();

	function close() {
		open = false;
	}
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && close()} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			aria-label="Close dialog"
			class="absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px]"
			onclick={close}
		></button>
		<div
			role="dialog"
			aria-modal="true"
			class="relative z-10 w-full max-w-md rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
		>
			<div class="flex items-start justify-between gap-4 px-5 pt-4">
				<div>
					<h2 class="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>
					{#if description}
						<p class="mt-0.5 text-sm text-neutral-500">{description}</p>
					{/if}
				</div>
				<button
					type="button"
					onclick={close}
					class="-mr-1 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
					aria-label="Close"
				>
					<X size={16} />
				</button>
			</div>
			{#if children}
				<div class="px-5 py-4">
					{@render children()}
				</div>
			{:else}
				<div class="pb-2"></div>
			{/if}
			{#if footer}
				<div
					class="flex justify-end gap-2 border-t border-neutral-100 px-5 py-3 dark:border-neutral-800"
				>
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
