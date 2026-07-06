<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, Check, KeyRound, ExternalLink, Plus } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';

	type CustomProvider = (typeof data.customProviders)[number];

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);

	const providerLabel: Record<string, string> = { github: 'GitHub', discord: 'Discord', modrinth: 'Modrinth' };

	// Track client IDs live so we can flag the common GitHub App-vs-OAuth-App mixup.
	let clientIds = $state<Record<string, string>>(
		Object.fromEntries(data.oauth.map((p) => [p.provider, p.clientId]))
	);
	// GitHub App client IDs start with "Iv"; OAuth App IDs start with "Ov" (or are 20-hex).
	const githubAppIdWarning = (provider: string, id: string) =>
		provider === 'github' && /^Iv/i.test(id.trim());

	function copy(text: string) {
		navigator.clipboard?.writeText(text);
	}

	function callbackFor(provider: string) {
		return data.oauthCallback.replace('{provider}', provider);
	}
</script>

<svelte:head><title>Privacy · Admin · OpenTrack</title></svelte:head>

<div class="mx-auto max-w-2xl px-8 py-8">
	<header class="mb-6">
		<h1 class="text-xl font-semibold tracking-tight">Privacy</h1>
		<p class="mt-0.5 text-sm text-neutral-500">OAuth login providers for sign-in.</p>
	</header>

	<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="flex items-center gap-2 text-sm font-semibold"><KeyRound size={15} /> OAuth login providers</h2>
		<p class="mt-1 mb-4 text-sm text-neutral-500">
			Register an OAuth app with each provider, then paste its credentials here. Use the callback URL shown per provider.
		</p>
		<div class="space-y-4">
			{#each data.oauth as p (p.provider)}
				<form method="POST" action="?/saveOAuth" use:enhance class="rounded-lg border border-neutral-100 p-4 dark:border-neutral-800/60">
					<input type="hidden" name="provider" value={p.provider} />
					<div class="mb-3 flex items-center justify-between">
						<span class="font-medium">{providerLabel[p.provider]}</span>
						{#if p.active}
							<span class="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300"><Check size={11} /> Enabled</span>
						{:else}
							<span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500 dark:bg-neutral-800">Disabled</span>
						{/if}
					</div>

					<div class="mb-3 space-y-1.5 rounded-lg bg-neutral-50 p-3 text-xs dark:bg-neutral-900">
						<div class="flex items-center gap-2">
							<span class="w-16 shrink-0 text-neutral-400">Callback</span>
							<code class="min-w-0 flex-1 truncate">{callbackFor(p.provider)}</code>
							<button type="button" onclick={() => copy(callbackFor(p.provider))} aria-label="Copy callback URL"><Copy size={12} /></button>
						</div>
						{#if p.meta}
							<div class="flex items-center gap-3 pt-0.5">
								<a href={p.meta.console} target="_blank" rel="noreferrer" class="flex items-center gap-1 text-brand-600 hover:underline">
									<ExternalLink size={11} /> Create app
								</a>
								<a href={p.meta.docs} target="_blank" rel="noreferrer" class="flex items-center gap-1 text-neutral-500 hover:underline">
									<ExternalLink size={11} /> Docs
								</a>
							</div>
						{/if}
					</div>

					<div class="flex flex-col gap-3 sm:flex-row">
						<div class="flex-1"><Field label="Client ID"><Input name="clientId" bind:value={clientIds[p.provider]} placeholder="client id" /></Field></div>
						<div class="flex-1"><Field label="Client secret"><Input name="clientSecret" type="password" placeholder={p.hasSecret ? '•••••• (leave blank to keep)' : 'client secret'} /></Field></div>
					</div>

					{#if githubAppIdWarning(p.provider, clientIds[p.provider] ?? '')}
						<p class="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
							This looks like a GitHub <strong>App</strong> Client ID (<code>Iv…</code>). OAuth <em>login</em> needs a GitHub <strong>OAuth App</strong> (its ID starts with <code>Ov…</code>) — create one via “Create app” above with the callback URL shown. Alternatively, register that callback URL on your existing GitHub App. Otherwise “Sign in with GitHub” will 404.
						</p>
					{/if}
					<div class="mt-3 flex items-center gap-3">
						<Button size="sm" variant="primary" type="submit">Save</Button>
						{#if f?.savedOAuth === p.provider}<span class="text-sm text-green-600">Saved</span>{/if}
						<span class="text-xs text-neutral-400">Clear the Client ID to disable.</span>
					</div>
				</form>
			{/each}
		</div>
	</section>

	<!-- Custom providers -->
	<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="flex items-center gap-2 text-sm font-semibold"><Plus size={15} /> Custom providers</h2>
		<p class="mt-1 mb-4 text-sm text-neutral-500">
			Add any OAuth2 / OpenID Connect provider (Google, GitLab, Keycloak, …). Give it a URL-safe key, a label, and an icon (emoji or image URL).
		</p>

		{#if f?.customError}<p class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">{f.customError}</p>{/if}
		{#if f?.savedCustom}<p class="mb-3 text-sm text-green-600">Saved.</p>{/if}
		{#if f?.deletedCustom}<p class="mb-3 text-sm text-neutral-500">Provider removed.</p>{/if}

		{#if data.customProviders.length}
			<div class="space-y-4">
				{#each data.customProviders as p (p.id)}
					{@render providerForm(p)}
				{/each}
			</div>
		{/if}

		<div class="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
			<p class="mb-3 text-sm font-medium">Add a provider</p>
			{@render providerForm(null)}
		</div>
	</section>
</div>

{#snippet providerForm(p: CustomProvider | null)}
	<form method="POST" action="?/saveCustomProvider" use:enhance class="rounded-lg border border-neutral-100 p-4 dark:border-neutral-800/60">
		<input type="hidden" name="id" value={p?.id ?? ''} />
		<div class="flex items-center justify-between">
			<div class="flex flex-wrap items-end gap-3">
				<div class="w-32"><Field label="Key" hint="url slug"><Input name="key" value={p?.key ?? ''} placeholder="google" readonly={!!p} required /></Field></div>
				<div class="w-40"><Field label="Label"><Input name="label" value={p?.label ?? ''} placeholder="Google" required /></Field></div>
				<div class="w-24"><Field label="Icon"><Input name="icon" value={p?.icon ?? ''} placeholder="🔵 / url" /></Field></div>
			</div>
			{#if p}
				{#if p.enabled}<span class="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">Enabled</span>
				{:else}<span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500 dark:bg-neutral-800">Disabled</span>{/if}
			{/if}
		</div>

		<p class="mt-2 text-xs text-neutral-500">
			Callback: <code class="rounded bg-neutral-100 px-1 dark:bg-neutral-800">{data.origin}/auth/oauth/{p?.key ?? '<key>'}/callback</code> — register this with the provider.
		</p>

		<div class="mt-3"><Field label="Discovery URL" hint="OIDC issuer (e.g. https://accounts.google.com) — fills the endpoints on save. Optional."><Input name="discoveryUrl" placeholder="https://accounts.google.com" /></Field></div>
		<div class="mt-3 space-y-3">
			<Field label="Authorization endpoint"><Input name="authorizationEndpoint" value={p?.authorizationEndpoint ?? ''} placeholder="https://…/authorize" /></Field>
			<Field label="Token endpoint"><Input name="tokenEndpoint" value={p?.tokenEndpoint ?? ''} placeholder="https://…/token" /></Field>
			<Field label="Userinfo endpoint"><Input name="userinfoEndpoint" value={p?.userinfoEndpoint ?? ''} placeholder="https://…/userinfo" /></Field>
		</div>
		<div class="mt-3 flex flex-col gap-3 sm:flex-row">
			<div class="flex-1"><Field label="Scopes"><Input name="scopes" value={p?.scopes ?? 'openid email profile'} /></Field></div>
		</div>
		<div class="mt-3 flex flex-col gap-3 sm:flex-row">
			<div class="flex-1"><Field label="Client ID"><Input name="clientId" value={p?.clientId ?? ''} placeholder="client id" /></Field></div>
			<div class="flex-1"><Field label="Client secret"><Input name="clientSecret" type="password" placeholder={p?.hasSecret ? '•••••• (leave blank to keep)' : 'client secret'} /></Field></div>
		</div>
		<label class="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" checked={p ? p.enabled : true} class="size-4 accent-brand-600" /> Enabled</label>

		<div class="mt-3 flex items-center gap-3">
			<Button size="sm" variant="primary" type="submit">{p ? 'Save' : 'Add provider'}</Button>
			{#if p}
				<button type="submit" formaction="?/deleteCustomProvider" onclick={(e) => !confirm(`Delete “${p.label}”?`) && e.preventDefault()} class="text-xs text-red-600 hover:underline">Delete</button>
			{/if}
		</div>
	</form>
{/snippet}
