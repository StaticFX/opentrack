<script lang="ts">
	import { enhance } from '$app/forms';
	import { Bell, Check, KeyRound, Trash2 } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import SaveBar from '$lib/components/ui/SaveBar.svelte';
	import { createDirtyGuard } from '$lib/dirty';
	import { toast } from '$lib/toast';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);
	let showManual = $state(false);

	let subject = $state(data.push.subject ?? '');
	const dirtyGuard = createDirtyGuard();
	const dirty = dirtyGuard.dirty;
	const pending = dirtyGuard.pending;
	let saving = $state(false);

	function discard() {
		subject = data.push.subject ?? '';
		dirtyGuard.markClean();
	}

	$effect(() => {
		if (f?.generated) toast('VAPID keys generated. Web Push is now active.', { tone: 'success' });
		else if (f?.savedKeys) toast('Push keys saved. Web Push is now active.', { tone: 'success' });
		else if (f?.disabled) toast('Web Push disabled.', { tone: 'info' });
		else if (f?.savedSubject) {
			dirtyGuard.markClean();
			toast('Contact subject saved.', { tone: 'success' });
		}
	});
</script>

<svelte:head><title>Notifications · Admin · OpenTrack</title></svelte:head>

<header class="mb-6">
	<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Notifications</h2>
	<p class="mt-0.5 text-[13px] text-[var(--dim)]">
		Web Push delivery — generate a VAPID keypair so users can receive browser notifications for
		the tickets and suggestions they follow.
	</p>
</header>

{#if f?.error}<p class="mb-4 border border-[color-mix(in_srgb,#f85149_35%,transparent)] bg-[color-mix(in_srgb,#f85149_10%,transparent)] px-3 py-2 text-[13px] text-[#f85149]">{f.error}</p>{/if}

<!-- Status -->
<section class="border-t border-[var(--rule)] pt-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<Bell size={16} class={data.push.active ? 'text-[var(--green)]' : 'text-[var(--faint)]'} aria-hidden="true" />
			<span class="text-[13px] font-medium text-[var(--text)]">
				{#if data.push.active}
					<span class="flex items-center gap-1 text-[var(--green)]"><Check size={14} aria-hidden="true" /> Web Push is active</span>
				{:else}
					Web Push is not configured
				{/if}
			</span>
		</div>
		{#if !data.push.active}
			<form method="POST" action="?/generate" use:enhance>
				<Button type="submit" variant="default"><KeyRound size={15} aria-hidden="true" /> Generate keys</Button>
			</form>
		{:else}
			<form method="POST" action="?/disable" use:enhance>
				<Button type="submit" variant="ghost"><Trash2 size={15} aria-hidden="true" /> Disable</Button>
			</form>
		{/if}
	</div>

	{#if data.push.publicKey}
		<div class="mt-4">
			<span class="text-[11px] font-medium tracking-wide text-[var(--faint)] uppercase">Public key</span>
			<code class="data-mono mt-1 block truncate bg-[var(--raised)] px-2.5 py-2 text-[var(--dim)]">{data.push.publicKey}</code>
		</div>
	{/if}
</section>

<!-- Contact subject -->
<section class="mt-8 border-t border-[var(--rule)] pt-6">
	<h3 class="mono-display text-[13px] text-[var(--text)]">Contact</h3>
	<p class="mt-1 mb-3 text-[13px] text-[var(--dim)]">
		The <code class="bg-[var(--raised)] px-1 text-[12px] text-[var(--text)]">mailto:</code> address push services use to reach you about your VAPID keys.
	</p>
	<form
		method="POST"
		action="?/saveSubject"
		use:enhance={() => async ({ update }) => {
			saving = true;
			await update();
			saving = false;
		}}
		oninput={() => dirtyGuard.markDirty()}
		class="flex items-end gap-2"
	>
		<div class="flex-1">
			<Field label="Subject">
				<Input name="subject" bind:value={subject} placeholder="mailto:admin@example.com" />
			</Field>
		</div>
		<Button type="submit" variant="default">Save</Button>
		<SaveBar dirty={$dirty} {saving} onDiscard={discard} />
	</form>
</section>

<!-- Manual key entry (advanced) -->
<section class="mt-8 border-t border-[var(--rule)] pt-6">
	<button type="button" onclick={() => (showManual = !showManual)} class="mono-focus text-[13px] font-medium text-[var(--dim)] transition-colors hover:text-[var(--text)]">
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

<Dialog
	bind:open={() => $pending, (v) => { if (!v) dirtyGuard.stay(); }}
	title="Discard changes?"
	description="You have unsaved edits. Leaving now will discard them."
>
	{#snippet footer()}
		<Button variant="ghost" type="button" onclick={() => dirtyGuard.stay()}>Keep editing</Button>
		<Button variant="danger" type="button" onclick={() => dirtyGuard.discard()}>Discard</Button>
	{/snippet}
</Dialog>
