<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, KeyRound, ExternalLink, Plus } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import IntegrationCard from '$lib/components/integrations/IntegrationCard.svelte';

	type Provider = (typeof data.providers)[number];

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);

	// Which provider's config modal is open: a provider selector or '__add__'.
	let openKey = $state<string | null>(null);
	const selector = (p: Provider) => (p.kind === 'custom' ? `custom:${p.id}` : p.key);
	const active = $derived<Provider | null>(
		openKey && openKey !== '__add__' ? (data.providers.find((p) => selector(p) === openKey) ?? null) : null
	);
	const isAdd = $derived(openKey === '__add__');

	// Track the client id typed in the GitHub modal to flag the App-vs-OAuth mixup.
	let clientIdDraft = $state('');

	function open(p: Provider) {
		clientIdDraft = p.clientId;
		openKey = selector(p);
	}
	function close() {
		openKey = null;
	}
	function copy(text: string) {
		navigator.clipboard?.writeText(text);
	}
	function callbackFor(key: string) {
		return data.oauthCallback.replace('{provider}', key);
	}
	const githubAppIdWarning = (key: string, id: string) => key === 'github' && /^Iv/i.test(id.trim());

	// Close the modal after a successful save/delete (and let `load` refresh data).
	const onSubmit = () => async ({ update, result }: any) => {
		await update();
		if (result.type === 'success') close();
	};
</script>

<svelte:head><title>Privacy · Admin · OpenTrack</title></svelte:head>

<div class="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
	<header class="mb-6">
		<h1 class="text-xl font-semibold tracking-tight">Privacy</h1>
		<p class="mt-0.5 text-sm text-neutral-500">OAuth login providers for sign-in. Every provider is configured here and stored in the database.</p>
	</header>

	<section class="mb-6">
		<h2 class="mb-3 flex items-center gap-2 text-sm font-semibold"><KeyRound size={15} /> OAuth login providers</h2>
		<div class="grid gap-3 sm:grid-cols-2">
			{#each data.providers as p (selector(p))}
				<IntegrationCard
					name={p.name}
					blurb={p.active ? 'Sign-in enabled.' : p.blurb}
					icon={p.icon}
					status={p.active ? 'connected' : 'disconnected'}
					selected={openKey === selector(p)}
					onclick={() => open(p)}
				/>
			{/each}
			<IntegrationCard
				name="Add provider"
				blurb="Google, GitLab, Keycloak — any OAuth2 / OIDC."
				icon="plug"
				status="disconnected"
				selected={isAdd}
				onclick={() => (openKey = '__add__')}
			/>
		</div>
	</section>
</div>

<Dialog
	bind:open={() => openKey !== null, (v) => { if (!v) close(); }}
	title={active ? active.name : 'Add a custom provider'}
	description={active?.kind === 'builtin' ? 'OAuth login credentials' : 'Any OAuth2 / OpenID Connect provider'}
>
	{#if f?.error}
		<p class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">{f.error}</p>
	{/if}

	{#if active?.kind === 'builtin'}
		{@const p = active}
		<form method="POST" action="?/saveBuiltin" use:enhance={onSubmit} class="max-h-[65vh] space-y-4 overflow-y-auto">
			<input type="hidden" name="key" value={p.key} />

			<div class="space-y-1.5 rounded-lg bg-neutral-50 p-3 text-xs dark:bg-neutral-900">
				<div class="flex items-center gap-2">
					<span class="w-16 shrink-0 text-neutral-400">Callback</span>
					<code class="min-w-0 flex-1 truncate">{callbackFor(p.key)}</code>
					<button type="button" onclick={() => copy(callbackFor(p.key))} aria-label="Copy callback URL"><Copy size={12} /></button>
				</div>
				{#if p.meta}
					<div class="flex items-center gap-3 pt-0.5">
						<a href={p.meta.consoleUrl} target="_blank" rel="noreferrer" class="flex items-center gap-1 text-brand-600 hover:underline"><ExternalLink size={11} /> Create app</a>
						<a href={p.meta.docsUrl} target="_blank" rel="noreferrer" class="flex items-center gap-1 text-neutral-500 hover:underline"><ExternalLink size={11} /> Docs</a>
					</div>
				{/if}
			</div>

			<Field label="Client ID"><Input name="clientId" bind:value={clientIdDraft} placeholder="client id" /></Field>
			<Field label="Client secret"><Input name="clientSecret" type="password" placeholder={p.hasSecret ? '•••••• (leave blank to keep)' : 'client secret'} /></Field>

			{#if githubAppIdWarning(p.key, clientIdDraft)}
				<p class="rounded-lg bg-blue-50 p-2.5 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">{p.meta?.note}</p>
			{/if}

			<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" checked={p.enabled} class="size-4 accent-brand-600" /> Enabled</label>
			<p class="text-xs text-neutral-400">Clear the Client ID and save to remove this provider.</p>

			<div class="flex justify-end gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
				<Button size="sm" variant="ghost" type="button" onclick={close}>Cancel</Button>
				<Button size="sm" variant="primary" type="submit">Save</Button>
			</div>
		</form>
	{:else}
		{@render customForm(active)}
	{/if}
</Dialog>

{#snippet customForm(p: Provider | null)}
	<form method="POST" action="?/saveCustom" use:enhance={onSubmit} class="max-h-[65vh] space-y-3 overflow-y-auto pr-0.5">
		<input type="hidden" name="id" value={p?.id ?? ''} />
		<div class="flex flex-wrap gap-3">
			<div class="w-28"><Field label="Key" hint="url slug"><Input name="key" value={p?.key ?? ''} placeholder="google" readonly={!!p} required /></Field></div>
			<div class="flex-1"><Field label="Label"><Input name="label" value={p?.name ?? ''} placeholder="Google" required /></Field></div>
			<div class="w-20"><Field label="Icon"><Input name="icon" value={p?.icon ?? ''} placeholder="🔵 / url" /></Field></div>
		</div>

		<p class="text-xs text-neutral-500">
			Callback: <code class="rounded bg-neutral-100 px-1 dark:bg-neutral-800">{callbackFor(p?.key ?? '<key>')}</code> — register this with the provider.
		</p>

		<Field label="Discovery URL" hint="OIDC issuer (e.g. https://accounts.google.com) — fills the endpoints on save. Optional."><Input name="discoveryUrl" placeholder="https://accounts.google.com" /></Field>
		<Field label="Authorization endpoint"><Input name="authorizationEndpoint" value={p?.authorizationEndpoint ?? ''} placeholder="https://…/authorize" /></Field>
		<Field label="Token endpoint"><Input name="tokenEndpoint" value={p?.tokenEndpoint ?? ''} placeholder="https://…/token" /></Field>
		<Field label="Userinfo endpoint"><Input name="userinfoEndpoint" value={p?.userinfoEndpoint ?? ''} placeholder="https://…/userinfo" /></Field>
		<Field label="Scopes"><Input name="scopes" value={p?.scopes ?? 'openid email profile'} /></Field>
		<div class="flex gap-3">
			<div class="flex-1"><Field label="Client ID"><Input name="clientId" value={p?.clientId ?? ''} placeholder="client id" /></Field></div>
			<div class="flex-1"><Field label="Client secret"><Input name="clientSecret" type="password" placeholder={p?.hasSecret ? '•••••• (leave blank to keep)' : 'client secret'} /></Field></div>
		</div>
		<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" checked={p ? p.enabled : true} class="size-4 accent-brand-600" /> Enabled</label>

		<div class="flex items-center justify-between border-t border-neutral-100 pt-3 dark:border-neutral-800">
			<div>
				{#if p}
					<button type="submit" formaction="?/deleteCustom" onclick={(e) => !confirm(`Delete “${p.name}”?`) && e.preventDefault()} class="text-xs text-red-600 hover:underline">Delete</button>
				{/if}
			</div>
			<div class="flex gap-2">
				<Button size="sm" variant="ghost" type="button" onclick={close}>Cancel</Button>
				<Button size="sm" variant="primary" type="submit">{p ? 'Save' : 'Add provider'}</Button>
			</div>
		</div>
	</form>
{/snippet}
