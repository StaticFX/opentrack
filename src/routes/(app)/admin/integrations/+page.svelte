<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, Check, ExternalLink, HardDrive, Cloud, TriangleAlert } from '@lucide/svelte';
	import { ADMIN_CATEGORY_ORDER, CATEGORY_META, byCategory, descriptor } from '$lib/integrations/catalog';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import IntegrationCard from '$lib/components/integrations/IntegrationCard.svelte';
	import { toast } from '$lib/toast';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);
	const gh = $derived(data.github);
	const s3 = $derived(data.storage);
	const mcp = $derived(data.mcp);

	type CardStatus = 'connected' | 'disconnected' | 'soon' | 'unavailable';
	function statusFor(key: string): CardStatus {
		if (key === 'github') return gh.active ? 'connected' : 'disconnected';
		if (key === 's3') return s3.active ? 'connected' : 'disconnected';
		if (key === 'mcp') return mcp.enabled ? 'connected' : 'disconnected';
		if (key === 'gitlab') return 'soon';
		return 'disconnected'; // notification providers are configured per-project
	}

	function copyMcp() {
		navigator.clipboard?.writeText(data.urls.mcp);
	}

	// Which integration's detail panel is open below the grid (a catalog key), or null.
	let selected = $state<string | null>(null);
	const active = $derived(selected ? descriptor(selected) : undefined);

	function copy(text: string) {
		navigator.clipboard?.writeText(text);
	}
	// Inline panel (project-settings model) — success just toasts; "test" stays
	// on the same panel so the result renders beside the button.
	const onSubmit = () => async ({ action, update, result }: any) => {
		await update();
		if (result.type === 'success' && !action.search.includes('test')) {
			toast('Integration saved.', { tone: 'success' });
		}
	};

	// Destruction Tier 2 — replaces the "clear the App ID" invisible pattern
	// with an explicit red button gated behind a confirm dialog.
	let confirmOpen = $state(false);
	let confirmButton = $state<HTMLButtonElement | null>(null);
	function askRemoveGithub(e: MouseEvent) {
		e.preventDefault();
		confirmButton = e.currentTarget as HTMLButtonElement;
		confirmOpen = true;
	}
	function confirmRemoveGithub() {
		confirmOpen = false;
		confirmButton?.form?.requestSubmit(confirmButton);
	}
</script>

<svelte:head><title>Integrations · Admin · OpenTrack</title></svelte:head>

<header class="mb-6">
	<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Integrations</h2>
	<p class="mt-0.5 text-[13px] text-[var(--dim)]">
		Instance-level integrations. Pick one to configure it. Notification channels are then connected per project.
	</p>
</header>

<div class="space-y-8">
	{#each ADMIN_CATEGORY_ORDER as cat (cat)}
		<section class="border-t border-[var(--rule)] pt-6">
			<p class="mb-3 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// {CATEGORY_META[cat].label}</p>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each byCategory(cat) as d (d.key)}
					<IntegrationCard
						name={d.name}
						blurb={d.blurb}
						icon={d.icon}
						status={statusFor(d.key)}
						selected={selected === d.key}
						onclick={() => (selected = d.key)}
					/>
				{/each}
			</div>
		</section>
	{/each}

	{#if active}
		<section class="border-t border-[var(--rule)] pt-6">
			<h3 class="mono-display mb-4 text-[13px] text-[var(--text)]">{active.name}</h3>

			{#if f?.error}<p class="mb-3 border border-[color-mix(in_srgb,#f85149_35%,transparent)] bg-[color-mix(in_srgb,#f85149_10%,transparent)] p-3 text-[13px] text-[#f85149]">{f.error}</p>{/if}

			{#if selected === 'github'}
				<form method="POST" action="?/saveGithub" use:enhance={onSubmit} class="space-y-3">
					<p class="text-[13px] text-[var(--dim)]">
						Bidirectional issue sync via a GitHub App.
						<a href={data.urls.newApp} target="_blank" rel="noreferrer" class="mono-focus inline-flex items-center gap-1 text-[var(--accent)] hover:underline"><ExternalLink size={12} aria-hidden="true" /> Register a new App</a>, then paste its details.
					</p>
					<div class="space-y-1 border border-[var(--rule)] bg-[var(--raised)] p-3 text-[12px]">
						<p class="text-[var(--dim)]">Use these URLs when registering the App:</p>
						<div class="flex items-center gap-2"><span class="w-16 text-[var(--faint)]">Setup</span><code class="data-mono min-w-0 flex-1 truncate text-[var(--text)]">{data.urls.setup}</code><button type="button" onclick={() => copy(data.urls.setup)} aria-label="Copy setup URL" class="mono-focus shrink-0 text-[var(--faint)] transition-colors hover:text-[var(--text)]"><Copy size={12} aria-hidden="true" /></button></div>
						<div class="flex items-center gap-2"><span class="w-16 text-[var(--faint)]">Webhook</span><code class="data-mono min-w-0 flex-1 truncate text-[var(--text)]">{data.urls.webhook}</code><button type="button" onclick={() => copy(data.urls.webhook)} aria-label="Copy webhook URL" class="mono-focus shrink-0 text-[var(--faint)] transition-colors hover:text-[var(--text)]"><Copy size={12} aria-hidden="true" /></button></div>
					</div>
					<div class="flex gap-3">
						<div class="flex-1"><Field label="App ID"><Input name="appId" value={gh.appId} placeholder="123456" /></Field></div>
						<div class="flex-1"><Field label="App slug" hint="from the app URL"><Input name="slug" value={gh.slug} placeholder="my-tracker" /></Field></div>
					</div>
					<Field label="Private key (.pem)" hint={gh.hasPrivateKey ? 'Stored. Paste a new key to replace it.' : 'Paste the full PEM contents.'}>
						<Textarea name="privateKey" rows={4} placeholder={gh.hasPrivateKey ? '•••••• (leave blank to keep)' : '-----BEGIN RSA PRIVATE KEY-----'} />
					</Field>
					<div class="flex flex-col gap-3 sm:flex-row">
						<div class="flex-1"><Field label="Webhook secret"><Input name="webhookSecret" type="password" placeholder={gh.hasWebhookSecret ? '•••••• (keep)' : 'secret'} /></Field></div>
					</div>
					<div class="flex flex-col gap-3 sm:flex-row">
						<div class="flex-1"><Field label="OAuth client ID"><Input name="clientId" value={gh.clientId} placeholder="optional" /></Field></div>
						<div class="flex-1"><Field label="OAuth client secret"><Input name="clientSecret" type="password" placeholder={gh.hasClientSecret ? '•••••• (keep)' : 'optional'} /></Field></div>
					</div>
					<div class="flex items-center justify-between border-t border-[var(--rule)] pt-3">
						{#if gh.appId}
							<button type="submit" form="remove-github-app" onclick={askRemoveGithub} class="mono-focus text-[12px] font-medium text-[#f85149] hover:underline">Remove GitHub App</button>
						{:else}
							<span></span>
						{/if}
						<Button size="sm" variant="primary" type="submit">Save</Button>
					</div>
				</form>
				<!-- Standalone: submits the same action with an empty App ID, which the
				     server treats as "disconnect the App" (clears all its secrets too). -->
				<form method="POST" action="?/saveGithub" use:enhance={onSubmit} id="remove-github-app" class="hidden" aria-hidden="true">
					<input type="hidden" name="appId" value="" />
				</form>
			{:else if selected === 's3'}
				<form method="POST" action="?/saveStorage" use:enhance={onSubmit} class="space-y-3">
					<div class="flex items-center gap-2 border border-[var(--rule)] bg-[var(--raised)] p-3 text-[12px] text-[var(--dim)]">
						{#if s3.active}<Cloud size={16} class="text-[var(--accent)]" aria-hidden="true" /> S3 is the active backend for new uploads.
						{:else}<HardDrive size={16} aria-hidden="true" /> Local disk is active. Configure + enable S3 below.{/if}
					</div>
					<p class="text-[13px] text-[var(--dim)]">R2: region <code class="bg-[var(--raised)] px-1 text-[11px] text-[var(--text)]">auto</code> + your account endpoint. MinIO: set the endpoint and enable path-style.</p>
					<div class="grid gap-3 sm:grid-cols-2">
						<Field label="Bucket"><Input name="bucket" value={s3.bucket} placeholder="opentrack" /></Field>
						<Field label="Region"><Input name="region" value={s3.region} placeholder="auto" /></Field>
					</div>
					<Field label="Endpoint" hint="Leave blank for AWS S3."><Input name="endpoint" value={s3.endpoint} placeholder="https://<account>.r2.cloudflarestorage.com" /></Field>
					<div class="grid gap-3 sm:grid-cols-2">
						<Field label="Access key ID"><Input name="accessKeyId" value={s3.accessKeyId} placeholder="access key id" /></Field>
						<Field label="Secret access key"><Input name="secretAccessKey" type="password" placeholder={s3.hasSecret ? '•••••• (leave blank to keep)' : 'secret access key'} /></Field>
					</div>
					<label class="flex items-center gap-2 text-[13px] text-[var(--text)]"><input type="checkbox" name="forcePathStyle" checked={s3.forcePathStyle} class="size-4 accent-[var(--accent)]" /> Force path-style URLs <span class="text-[11px] text-[var(--faint)]">(MinIO)</span></label>
					<label class="flex items-center gap-2 text-[13px] text-[var(--text)]"><input type="checkbox" name="s3Enabled" checked={s3.s3Enabled} class="size-4 accent-[var(--accent)]" /> Use S3 for new uploads</label>
					{#if s3.configured}
						<p class="border border-[color-mix(in_srgb,var(--amber)_35%,transparent)] bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] p-2.5 text-[12px] text-[var(--amber)]">Switching only affects new uploads; existing files keep their backend.</p>
					{/if}
					<div class="flex items-center gap-3 border-t border-[var(--rule)] pt-3">
						<Button size="sm" variant="default" type="submit" formaction="?/testStorage">Test connection</Button>
						{#if f?.tested}<span class="flex items-center gap-1 text-[12px] text-[var(--green)]"><Check size={12} aria-hidden="true" /> Connected</span>{/if}
						{#if f?.testError}<span class="flex items-center gap-1 text-[12px] text-[#f85149]"><TriangleAlert size={12} aria-hidden="true" /> {f.testError}</span>{/if}
						<Button size="sm" variant="primary" type="submit" class="ml-auto">Save</Button>
					</div>
				</form>
			{:else if selected === 'mcp'}
				<form method="POST" action="?/saveMcp" use:enhance={onSubmit} class="space-y-3">
					<p class="text-[13px] text-[var(--dim)]">
						Exposes a <a href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer" class="mono-focus text-[var(--accent)] hover:underline">Model Context Protocol</a> server so AI assistants (Claude, etc.) can list, search, create, update, and comment on tickets.
					</p>
					<div class="space-y-1 border border-[var(--rule)] bg-[var(--raised)] p-3 text-[12px]">
						<div class="flex items-center gap-2">
							<span class="w-16 shrink-0 text-[var(--faint)]">Endpoint</span>
							<code class="data-mono min-w-0 flex-1 truncate text-[var(--text)]">{data.urls.mcp}</code>
							<button type="button" onclick={copyMcp} aria-label="Copy MCP URL" class="mono-focus shrink-0 text-[var(--faint)] transition-colors hover:text-[var(--text)]"><Copy size={12} aria-hidden="true" /></button>
						</div>
						<p class="pt-1 text-[var(--dim)]">Authenticate with a workspace <strong class="text-[var(--text)]">API key</strong> as a Bearer token (create one in <span class="font-medium text-[var(--text)]">Workspace → Settings → API keys</span>). The server is scoped to that key's workspace; changes are attributed to the key's creator.</p>
					</div>
					<label class="flex items-center gap-2 text-[13px] text-[var(--text)]"><input type="checkbox" name="enabled" checked={mcp.enabled} class="size-4 accent-[var(--accent)]" /> Enable the MCP server</label>
					<div class="flex justify-end border-t border-[var(--rule)] pt-3">
						<Button size="sm" variant="primary" type="submit">Save</Button>
					</div>
				</form>
			{:else if selected === 'gitlab'}
				<p class="text-[13px] text-[var(--dim)]">
					GitLab issue sync is scaffolded and coming soon. No instance-level setup is needed — projects will connect it with a project access token from their own Integrations tab.
				</p>
			{:else}
				<p class="text-[13px] text-[var(--dim)]">
					{active.name} needs no instance-level setup. Connect it per project from the project's <span class="font-medium text-[var(--text)]">Settings → Integrations</span> tab by pasting an incoming-webhook URL.
				</p>
			{/if}
		</section>
	{/if}
</div>

<Dialog bind:open={confirmOpen} title="Remove the GitHub App?" description="Sync stops for every linked repository across all workspaces. Secrets are cleared and can't be recovered — you'll need to paste them again to reconnect.">
	{#snippet footer()}
		<Button variant="ghost" type="button" onclick={() => (confirmOpen = false)}>Cancel</Button>
		<Button variant="danger" type="button" onclick={confirmRemoveGithub}>Remove</Button>
	{/snippet}
</Dialog>
