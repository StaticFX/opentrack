<script lang="ts">
	import { enhance } from '$app/forms';
	import { Bell, Check, KeyRound, Trash2 } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);
	let showManual = $state(false);
</script>

<svelte:head><title>Notifications · Admin · OpenTrack</title></svelte:head>

<div class="mx-auto max-w-2xl px-8 py-8">
	<header class="mb-6">
		<h1 class="text-xl font-semibold tracking-tight">Notifications</h1>
		<p class="mt-0.5 text-sm text-neutral-500">
			Web Push delivery. Generate a VAPID keypair to let users receive browser notifications for the
			tickets and suggestions they follow.
		</p>
	</header>

	{#if f?.error}<p class="mb-4 rounded-lg bg-red-50 p-2.5 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">{f.error}</p>{/if}
	{#if f?.generated || f?.savedKeys}<p class="mb-4 rounded-lg bg-green-50 p-2.5 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-300">Push keys saved. Web Push is now active.</p>{/if}
	{#if f?.disabled}<p class="mb-4 rounded-lg bg-neutral-100 p-2.5 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">Web Push disabled.</p>{/if}

	<!-- Status -->
	<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Bell size={16} class={data.push.active ? 'text-green-500' : 'text-neutral-400'} />
				<span class="text-sm font-medium">
					{#if data.push.active}
						<span class="flex items-center gap-1 text-green-600 dark:text-green-400"><Check size={14} /> Web Push is active</span>
					{:else}
						Web Push is not configured
					{/if}
				</span>
			</div>
			{#if !data.push.active}
				<form method="POST" action="?/generate" use:enhance>
					<Button type="submit" variant="default"><KeyRound size={15} /> Generate keys</Button>
				</form>
			{:else}
				<form method="POST" action="?/disable" use:enhance>
					<Button type="submit" variant="ghost"><Trash2 size={15} /> Disable</Button>
				</form>
			{/if}
		</div>

		{#if data.push.publicKey}
			<div class="mt-4">
				<span class="text-xs font-medium text-neutral-500">Public key</span>
				<code class="mt-1 block truncate rounded-lg bg-neutral-50 px-2.5 py-2 font-mono text-xs text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-400">{data.push.publicKey}</code>
			</div>
		{/if}
	</section>

	<!-- Contact subject -->
	<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="text-sm font-semibold">Contact</h2>
		<p class="mt-1 mb-3 text-sm text-neutral-500">
			The <code class="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">mailto:</code> address push services use to reach you about your VAPID keys.
		</p>
		<form method="POST" action="?/saveSubject" use:enhance class="flex items-end gap-2">
			<div class="flex-1">
				<Field label="Subject">
					<Input name="subject" value={data.push.subject} placeholder="mailto:admin@example.com" />
				</Field>
			</div>
			<Button type="submit" variant="default">Save</Button>
		</form>
		{#if f?.savedSubject}<p class="mt-2 text-sm text-green-600">Saved.</p>{/if}
	</section>

	<!-- Manual key entry (advanced) -->
	<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<button type="button" onclick={() => (showManual = !showManual)} class="text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-300">
			{showManual ? '▾' : '▸'} Enter keys manually
		</button>
		{#if showManual}
			<form method="POST" action="?/saveKeys" use:enhance class="mt-3 space-y-3">
				<Field label="Public key"><Input name="publicKey" placeholder="B…" /></Field>
				<Field label="Private key"><Input name="privateKey" placeholder="stored encrypted" /></Field>
				<Button type="submit" variant="default">Save keys</Button>
			</form>
		{/if}
	</section>
</div>
