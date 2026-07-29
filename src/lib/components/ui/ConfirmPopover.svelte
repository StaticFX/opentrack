<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';
	import Popover, { type PopoverPlacement, type PopoverTriggerProps } from './Popover.svelte';

	// Destruction Tier 1: anchored one-click confirm for scoped, frequent
	// deletes. Focus lands on the confirm button; Esc / outside click cancels.
	type Props = {
		message: string;
		confirmLabel?: string;
		danger?: boolean;
		onconfirm: () => void;
		placement?: PopoverPlacement;
		trigger: Snippet<[PopoverTriggerProps]>;
	};
	let {
		message,
		confirmLabel = 'Delete',
		danger = true,
		onconfirm,
		placement = 'bottom-start',
		trigger
	}: Props = $props();

	let open = $state(false);

	function confirm() {
		open = false;
		onconfirm();
	}
</script>

<Popover bind:open {placement} modal class="w-60 p-3" {trigger}>
	{#snippet content()}
		<p class="text-[13px] text-neutral-700 dark:text-neutral-200">{message}</p>
		<!-- Confirm first in DOM (modal Popover focuses it); row-reverse keeps it right. -->
		<div class="mt-3 flex flex-row-reverse justify-start gap-2">
			<Button size="sm" variant={danger ? 'danger' : 'primary'} type="button" onclick={confirm}>
				{confirmLabel}
			</Button>
			<Button size="sm" variant="ghost" type="button" onclick={() => (open = false)}>Cancel</Button>
		</div>
	{/snippet}
</Popover>
