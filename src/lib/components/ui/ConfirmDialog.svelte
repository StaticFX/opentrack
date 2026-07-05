<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';
	import Input from './Input.svelte';

	type Props = {
		open?: boolean;
		title: string;
		description?: string;
		confirmLabel?: string;
		/** Form action to POST when confirmed (e.g. "?/deleteWorkspace"). */
		action: string;
		/** If set, the user must type this exact text to enable the confirm button. */
		requireText?: string;
	};
	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel = 'Delete',
		action,
		requireText
	}: Props = $props();

	let typed = $state('');
	const disabled = $derived(requireText ? typed !== requireText : false);

	// Reset the typed value whenever the dialog closes.
	$effect(() => {
		if (!open) typed = '';
	});
</script>

<Dialog bind:open {title} {description}>
	{#if requireText}
		<p class="mb-2 text-sm text-neutral-500">
			Type <span class="font-semibold text-neutral-700 dark:text-neutral-200">{requireText}</span> to confirm.
		</p>
		<Input bind:value={typed} placeholder={requireText} autocomplete="off" />
	{/if}

	{#snippet footer()}
		<Button variant="ghost" type="button" onclick={() => (open = false)}>Cancel</Button>
		<form method="POST" {action} use:enhance>
			<input type="hidden" name="_confirm" value="1" />
			<Button variant="danger" type="submit" {disabled}>{confirmLabel}</Button>
		</form>
	{/snippet}
</Dialog>
