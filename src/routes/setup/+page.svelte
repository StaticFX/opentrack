<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, ArrowRight } from '@lucide/svelte';
	import AuthCard from '$lib/components/app/AuthCard.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);

	let step = $state(1);
	let username = $state('');
	let code = $state('');
	let password = $state('');
	let confirm = $state('');
	let submitting = $state(false);

	// Bounce back to the right step when the server rejects the claim.
	$effect(() => {
		if (f?.field === 'account') step = 1;
		else if (f?.field === 'password') step = 2;
	});

	function next() {
		if (username.trim().length >= 2 && code.trim().length > 0) step = 2;
	}
</script>

<svelte:head><title>Set up OpenTrack</title></svelte:head>

<AuthCard title="Create the admin account" sub="Claim this instance with the setup code from your server logs.">
	<div class="flex items-center justify-center gap-2" aria-hidden="true">
		{#each [1, 2] as s (s)}
			<span
				class={`h-1.5 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none ${step === s ? 'w-6 bg-[var(--accent)]' : 'w-1.5 bg-[var(--rule)]'}`}
			></span>
		{/each}
	</div>

	{#if f?.error}
		<p class="text-[13px] text-[#f85149]">{f.error}</p>
	{/if}

	<form
		method="POST"
		action="?/claim"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		<!-- Step 1: identity + setup code -->
		<div class="flex flex-col gap-4" class:hidden={step !== 1}>
			<Field label="Username">
				<Input
					name="username"
					bind:value={username}
					autocomplete="username"
					placeholder="e.g. jordan"
					autofocus
				/>
			</Field>
			<Field label="Setup code" hint="Printed in your server logs on first start.">
				<Input
					name="code"
					bind:value={code}
					autocomplete="one-time-code"
					placeholder="XXXX-XXXX"
					spellcheck="false"
					class="font-mono tracking-widest"
				/>
			</Field>
			<Button
				type="button"
				variant="primary"
				class="w-full"
				onclick={next}
				disabled={username.trim().length < 2 || !code.trim()}
			>
				Continue <ArrowRight size={16} />
			</Button>
		</div>

		<!-- Step 2: choose a password -->
		<div class="flex flex-col gap-4" class:hidden={step !== 2}>
			<Field label="Password">
				<Input
					name="password"
					type="password"
					bind:value={password}
					autocomplete="new-password"
					placeholder="At least 8 characters"
				/>
			</Field>
			<Field label="Confirm password">
				<Input
					name="confirm"
					type="password"
					bind:value={confirm}
					autocomplete="new-password"
					placeholder="Re-enter your password"
				/>
			</Field>
			<div class="flex gap-2">
				<Button type="button" variant="ghost" onclick={() => (step = 1)}>
					<ArrowLeft size={16} /> Back
				</Button>
				<Button type="submit" variant="primary" class="flex-1" loading={submitting}>
					Create admin account
				</Button>
			</div>
		</div>
	</form>
</AuthCard>
