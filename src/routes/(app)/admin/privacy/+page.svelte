<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, KeyRound, ExternalLink } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import IntegrationCard from '$lib/components/integrations/IntegrationCard.svelte';
	import { toast } from '$lib/toast';

	type Provider = (typeof data.providers)[number];

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);

	// Which provider's detail panel is open below the grid: a provider
	// selector or '__add__'. Inline panel (project-settings model) — not a
	// modal, so there's nothing to "close" on save, only to select.
	let selected = $state<string | null>(null);
	const selector = (p: Provider) => (p.kind === 'custom' ? `custom:${p.id}` : p.key);
	const active = $derived<Provider | null>(
		selected && selected !== '__add__' ? (data.providers.find((p) => selector(p) === selected) ?? null) : null
	);
	const isAdd = $derived(selected === '__add__');

	// Track the client id typed in the GitHub modal to flag the App-vs-OAuth mixup.
	let clientIdDraft = $state('');

	function select(p: Provider) {
		clientIdDraft = p.clientId;
		selected = selector(p);
	}
	function copy(text: string) {
		navigator.clipboard?.writeText(text);
	}
	function callbackFor(key: string) {
		return data.oauthCallback.replace('{provider}', key);
	}
	const githubAppIdWarning = (key: string, id: string) => key === 'github' && /^Iv/i.test(id.trim());

	const onSubmit = () => async ({ update, result }: any) => {
		await update();
		if (result.type === 'success') toast('Provider saved.', { tone: 'success' });
	};

	// Destruction Tier 2 — replaces native confirm(): custom-provider delete and
	// the builtin "clear the Client ID" removal both submit a real form; the
	// visible button just gates that submission behind this dialog. No-JS
	// still works (the button is a real submit, associated via `form=` where
	// the remove action needs its own standalone form).
	let confirmOpen = $state(false);
	let confirmButton = $state<HTMLButtonElement | null>(null);
	let confirmDesc = $state('');
	function askRemove(e: MouseEvent, name: string) {
		e.preventDefault();
		confirmButton = e.currentTarget as HTMLButtonElement;
		confirmDesc = `Sign-in via ${name} stops working immediately. You can add it again later.`;
		confirmOpen = true;
	}
	function confirmRemove() {
		confirmOpen = false;
		confirmButton?.form?.requestSubmit(confirmButton);
	}
</script>

<svelte:head><title>Sign-in &amp; OAuth · Admin · OpenTrack</title></svelte:head>

<header class="mb-6">
	<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Sign-in &amp; OAuth</h2>
	<p class="mt-0.5 text-[13px] text-[var(--dim)]">OAuth login providers for sign-in. Every provider is configured here and stored in the database.</p>
</header>

<section class="border-t border-[var(--rule)] pt-6">
	<p class="mb-3 flex items-center gap-1.5 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase"><KeyRound size={12} aria-hidden="true" /> OAuth login providers</p>
	<div class="grid gap-3 sm:grid-cols-2">
		{#each data.providers as p (selector(p))}
			<IntegrationCard
				name={p.name}
				blurb={p.active ? 'Sign-in enabled.' : p.blurb}
				icon={p.icon}
				status={p.active ? 'connected' : 'disconnected'}
				selected={selected === selector(p)}
				onclick={() => select(p)}
			/>
		{/each}
		<IntegrationCard
			name="Add provider"
			blurb="Google, GitLab, Keycloak — any OAuth2 / OIDC."
			icon="plug"
			status="disconnected"
			selected={isAdd}
			onclick={() => (selected = '__add__')}
		/>
	</div>
</section>

{#if active || isAdd}
	<section class="mt-8 border-t border-[var(--rule)] pt-6">
		<h3 class="mono-display mb-4 text-[13px] text-[var(--text)]">{active ? active.name : 'Add a custom provider'}</h3>

		{#if f?.error}
			<p class="mb-3 border border-[color-mix(in_srgb,#f85149_35%,transparent)] bg-[color-mix(in_srgb,#f85149_10%,transparent)] p-3 text-[13px] text-[#f85149]">{f.error}</p>
		{/if}

		{#if active?.kind === 'builtin'}
			{@const p = active}
			<form method="POST" action="?/saveBuiltin" use:enhance={onSubmit} class="space-y-4">
				<input type="hidden" name="key" value={p.key} />

				<div class="space-y-1.5 border border-[var(--rule)] bg-[var(--raised)] p-3 text-[12px]">
					<div class="flex items-center gap-2">
						<span class="w-16 shrink-0 text-[var(--faint)]">Callback</span>
						<code class="data-mono min-w-0 flex-1 truncate text-[var(--text)]">{callbackFor(p.key)}</code>
						<button type="button" onclick={() => copy(callbackFor(p.key))} aria-label="Copy callback URL" class="mono-focus shrink-0 text-[var(--faint)] transition-colors hover:text-[var(--text)]"><Copy size={12} aria-hidden="true" /></button>
					</div>
					{#if p.meta}
						<div class="flex items-center gap-3 pt-0.5">
							<a href={p.meta.consoleUrl} target="_blank" rel="noreferrer" class="mono-focus flex items-center gap-1 text-[var(--accent)] hover:underline"><ExternalLink size={11} aria-hidden="true" /> Create app</a>
							<a href={p.meta.docsUrl} target="_blank" rel="noreferrer" class="mono-focus flex items-center gap-1 text-[var(--faint)] hover:underline"><ExternalLink size={11} aria-hidden="true" /> Docs</a>
						</div>
					{/if}
				</div>

				<Field label="Client ID"><Input name="clientId" bind:value={clientIdDraft} placeholder="client id" /></Field>
				<Field label="Client secret"><Input name="clientSecret" type="password" placeholder={p.hasSecret ? '•••••• (leave blank to keep)' : 'client secret'} /></Field>

				{#if githubAppIdWarning(p.key, clientIdDraft)}
					<p class="border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] p-2.5 text-[12px] text-[var(--accent-fg)]">{p.meta?.note}</p>
				{/if}

				<label class="flex items-center gap-2 text-[13px] text-[var(--text)]"><input type="checkbox" name="enabled" checked={p.enabled} class="size-4 accent-[var(--accent)]" /> Enabled</label>

				<div class="flex items-center justify-between border-t border-[var(--rule)] pt-3">
					{#if p.clientId}
						<button type="submit" form={`remove-builtin-${p.key}`} onclick={(e) => askRemove(e, p.name)} class="mono-focus text-[12px] font-medium text-[#f85149] hover:underline">Remove provider</button>
					{:else}
						<span></span>
					{/if}
					<Button size="sm" variant="primary" type="submit">Save</Button>
				</div>
			</form>
			<!-- Standalone: submits the same action with an empty Client ID, which the
			     server treats as "remove this provider". Kept outside the edit form so
			     the visible draft value never leaks into the remove request. -->
			<form method="POST" action="?/saveBuiltin" use:enhance={onSubmit} id={`remove-builtin-${p.key}`} class="hidden" aria-hidden="true">
				<input type="hidden" name="key" value={p.key} />
				<input type="hidden" name="clientId" value="" />
			</form>
		{:else}
			{@render customForm(active)}
		{/if}
	</section>
{/if}

{#snippet customForm(p: Provider | null)}
	<form method="POST" action="?/saveCustom" use:enhance={onSubmit} class="space-y-3">
		<input type="hidden" name="id" value={p?.id ?? ''} />
		<div class="flex flex-wrap gap-3">
			<div class="w-28"><Field label="Key" hint="url slug"><Input name="key" value={p?.key ?? ''} placeholder="google" readonly={!!p} required /></Field></div>
			<div class="flex-1"><Field label="Label"><Input name="label" value={p?.name ?? ''} placeholder="Google" required /></Field></div>
			<div class="w-20"><Field label="Icon"><Input name="icon" value={p?.icon ?? ''} placeholder="🔵 / url" /></Field></div>
		</div>

		<p class="text-[12px] text-[var(--dim)]">
			Callback: <code class="bg-[var(--raised)] px-1 text-[var(--text)]">{callbackFor(p?.key ?? '<key>')}</code> — register this with the provider.
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
		<label class="flex items-center gap-2 text-[13px] text-[var(--text)]"><input type="checkbox" name="enabled" checked={p ? p.enabled : true} class="size-4 accent-[var(--accent)]" /> Enabled</label>

		<div class="flex items-center justify-between border-t border-[var(--rule)] pt-3">
			<div>
				{#if p}
					<button type="submit" formaction="?/deleteCustom" onclick={(e) => askRemove(e, p.name)} class="mono-focus text-[12px] font-medium text-[#f85149] hover:underline">Delete</button>
				{/if}
			</div>
			<Button size="sm" variant="primary" type="submit">{p ? 'Save' : 'Add provider'}</Button>
		</div>
	</form>
{/snippet}

<Dialog bind:open={confirmOpen} title="Remove provider?" description={confirmDesc}>
	{#snippet footer()}
		<Button variant="ghost" type="button" onclick={() => (confirmOpen = false)}>Cancel</Button>
		<Button variant="danger" type="button" onclick={confirmRemove}>Remove</Button>
	{/snippet}
</Dialog>
