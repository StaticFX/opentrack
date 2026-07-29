<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthCard from '$lib/components/app/AuthCard.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Redeem invite · OpenTrack</title></svelte:head>

<AuthCard title="Redeem an invite" sub="Enter the code an admin gave you to unlock internal access.">
	<form method="POST" use:enhance class="flex flex-col gap-4">
		{#if form?.error}
			<p class="text-[13px] text-[#f85149]">{form.error}</p>
		{/if}
		<Field label="Invite code">
			<Input
				name="code"
				placeholder="ABCD-EFGH-IJKL-MNOP"
				value={form?.code ?? data.prefill}
				required
				autocomplete="off"
				class="text-center font-mono tracking-wider uppercase"
			/>
		</Field>
		<Button type="submit" variant="primary" class="w-full">Redeem</Button>
	</form>
</AuthCard>
