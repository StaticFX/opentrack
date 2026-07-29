<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, Plus, Trash2 } from '@lucide/svelte';
	import { API_SCOPES } from '$lib/apiScopes';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { toast } from '$lib/toast';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);

	let workspaceId = $state(data.workspaces[0]?.id ?? '');
	const wsOptions = $derived(data.workspaces.map((w) => ({ value: w.id, label: w.name })));

	function copy(t: string) {
		navigator.clipboard?.writeText(t);
	}

	// Destruction Tier 2: the real per-row form carries `id`; the button just
	// gates submission behind a styled confirm (native confirm() retired).
	let confirmOpen = $state(false);
	let confirmButton = $state<HTMLButtonElement | null>(null);
	let confirmName = $state('');
	function askRevoke(e: MouseEvent, name: string) {
		e.preventDefault();
		confirmButton = e.currentTarget as HTMLButtonElement;
		confirmName = name;
		confirmOpen = true;
	}
	function confirmRevoke() {
		confirmOpen = false;
		confirmButton?.form?.requestSubmit(confirmButton);
		toast('Token revoked.', { tone: 'success' });
	}
</script>

<svelte:head><title>API Tokens · Admin · OpenTrack</title></svelte:head>

<header class="mb-6">
	<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">API tokens</h2>
	<p class="mt-0.5 text-[13px] text-[var(--dim)]">Programmatic + MCP access, scoped to a workspace. Workspace owners can also manage their own keys in workspace settings.</p>
</header>

<!-- Create -->
<section class="mb-8 border-t border-[var(--rule)] pt-6">
	<h3 class="mono-display text-[13px] text-[var(--text)]">Create a token</h3>
	{#if f?.apiKeyRaw}
		<div class="mt-3 mb-4 border border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] p-3">
			<p class="mb-1 text-[11px] font-medium text-[var(--green)]">Copy "{f.apiKeyName}" now — it won't be shown again.</p>
			<div class="flex items-center gap-2">
				<code class="data-mono min-w-0 flex-1 truncate bg-[var(--raised)] px-2 py-1.5 text-[12px] text-[var(--text)]">{f.apiKeyRaw}</code>
				<button type="button" onclick={() => copy(f.apiKeyRaw)} class="mono-focus shrink-0 rounded-[3px] p-1.5 text-[var(--faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--text)_8%,transparent)] hover:text-[var(--text)]" aria-label="Copy"><Copy size={14} /></button>
			</div>
		</div>
	{/if}
	{#if f?.error}<p class="mt-3 mb-3 text-[13px] text-[#f85149]">{f.error}</p>{/if}

	{#if !data.workspaces.length}
		<p class="mt-3 text-[13px] text-[var(--faint)]">No workspaces yet.</p>
	{:else}
		<form method="POST" action="?/createKey" use:enhance class="mt-4 flex flex-col gap-3">
			<div class="grid gap-3 sm:grid-cols-2">
				<Field label="Workspace"><Select name="workspaceId" bind:value={workspaceId} options={wsOptions} /></Field>
				<Field label="Token name"><Input name="name" placeholder="e.g. CI pipeline" /></Field>
			</div>
			<div class="flex flex-wrap gap-4">
				{#each API_SCOPES as sc (sc)}
					<label class="flex items-center gap-2 text-[13px] text-[var(--text)]"><input type="checkbox" name="scope" value={sc} checked={sc === 'read'} class="size-4 accent-[var(--accent)]" /> {sc}</label>
				{/each}
			</div>
			<div><Button size="sm" variant="primary" type="submit"><Plus size={14} /> Create token</Button></div>
		</form>
	{/if}
</section>

<!-- List -->
<section class="border-t border-[var(--rule)] pt-6">
	<p class="mb-3 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// All tokens</p>
	{#if !data.keys.length}
		<p class="text-[13px] text-[var(--faint)]">No API tokens yet.</p>
	{:else}
		<ul class="border-t border-[var(--rule)]">
			{#each data.keys as k (k.id)}
				<li class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--rule)] py-3 text-[13px]">
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-1.5">
							<span class="truncate font-medium text-[var(--text)]">{k.name}</span>
							{#each k.scopes as sc (sc)}<Badge>{sc}</Badge>{/each}
						</div>
						<div class="text-[12px] text-[var(--faint)]">
							{k.workspaceName} · <span class="data-mono">{k.prefix}…</span> · {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : 'never used'}
						</div>
					</div>
					<form method="POST" action="?/revokeKey" use:enhance>
						<input type="hidden" name="id" value={k.id} />
						<button type="submit" onclick={(e) => askRevoke(e, k.name)} class="hit mono-focus rounded-[3px] p-1.5 text-[var(--faint)] transition-colors hover:bg-[color-mix(in_srgb,#f85149_12%,transparent)] hover:text-[#f85149]" aria-label="Revoke"><Trash2 size={15} /></button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<Dialog bind:open={confirmOpen} title="Revoke token?" description={`Clients using “${confirmName}” will stop working immediately.`}>
	{#snippet footer()}
		<Button variant="ghost" type="button" onclick={() => (confirmOpen = false)}>Cancel</Button>
		<Button variant="danger" type="button" onclick={confirmRevoke}>Revoke</Button>
	{/snippet}
</Dialog>
