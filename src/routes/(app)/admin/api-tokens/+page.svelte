<script lang="ts">
	import { enhance } from '$app/forms';
	import { KeyRound, Copy, Plus, Trash2 } from '@lucide/svelte';
	import { API_SCOPES } from '$lib/apiScopes';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);

	let workspaceId = $state(data.workspaces[0]?.id ?? '');
	const wsOptions = $derived(data.workspaces.map((w) => ({ value: w.id, label: w.name })));

	function copy(t: string) {
		navigator.clipboard?.writeText(t);
	}
</script>

<svelte:head><title>API Tokens · Admin · OpenTrack</title></svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
	<header class="mb-6">
		<h1 class="flex items-center gap-2 text-xl font-semibold tracking-tight"><KeyRound size={20} /> API tokens</h1>
		<p class="mt-0.5 text-sm text-neutral-500">Programmatic + MCP access, scoped to a workspace. Workspace owners can also manage their own keys in workspace settings.</p>
	</header>

	<!-- Create -->
	<section class="mb-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="mb-3 text-sm font-semibold">Create a token</h2>
		{#if f?.apiKeyRaw}
			<div class="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900/50 dark:bg-green-950/30">
				<p class="mb-1 text-xs font-medium text-green-700 dark:text-green-300">Copy “{f.apiKeyName}” now — it won't be shown again.</p>
				<div class="flex items-center gap-2">
					<code class="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5 font-mono text-xs dark:bg-neutral-900">{f.apiKeyRaw}</code>
					<button type="button" onclick={() => copy(f.apiKeyRaw)} class="shrink-0 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Copy"><Copy size={14} /></button>
				</div>
			</div>
		{/if}
		{#if f?.error}<p class="mb-3 text-sm text-red-600">{f.error}</p>{/if}

		{#if !data.workspaces.length}
			<p class="text-sm text-neutral-400">No workspaces yet.</p>
		{:else}
			<form method="POST" action="?/createKey" use:enhance class="flex flex-col gap-3">
				<div class="grid gap-3 sm:grid-cols-2">
					<Field label="Workspace"><Select name="workspaceId" bind:value={workspaceId} options={wsOptions} /></Field>
					<Field label="Token name"><Input name="name" placeholder="e.g. CI pipeline" /></Field>
				</div>
				<div class="flex flex-wrap gap-4">
					{#each API_SCOPES as sc (sc)}
						<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="scope" value={sc} checked={sc === 'read'} class="size-4 accent-brand-600" /> {sc}</label>
					{/each}
				</div>
				<div><Button size="sm" variant="primary" type="submit"><Plus size={14} /> Create token</Button></div>
			</form>
		{/if}
	</section>

	<!-- List -->
	<section class="rounded-xl border border-neutral-200 dark:border-neutral-800">
		<h2 class="border-b border-neutral-100 px-4 py-3 text-sm font-semibold dark:border-neutral-800">All tokens</h2>
		{#if !data.keys.length}
			<p class="px-4 py-6 text-sm text-neutral-400">No API tokens yet.</p>
		{:else}
			<ul class="divide-y divide-neutral-100 dark:divide-neutral-800">
				{#each data.keys as k (k.id)}
					<li class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-1.5">
								<span class="truncate font-medium">{k.name}</span>
								{#each k.scopes as sc (sc)}<span class="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800">{sc}</span>{/each}
							</div>
							<div class="text-xs text-neutral-400">
								{k.workspaceName} · {k.prefix}… · {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : 'never used'}
							</div>
						</div>
						<form method="POST" action="?/revokeKey" use:enhance>
							<input type="hidden" name="id" value={k.id} />
							<button type="submit" class="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" aria-label="Revoke"
								onclick={(e) => !confirm(`Revoke token “${k.name}”? Clients using it will stop working.`) && e.preventDefault()}><Trash2 size={15} /></button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
