<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, Check, GitBranch, ExternalLink, HardDrive, Cloud, TriangleAlert } from '@lucide/svelte';
	import { ADMIN_CATEGORY_ORDER, CATEGORY_META, byCategory, descriptor } from '$lib/integrations/catalog';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import IntegrationCard from '$lib/components/integrations/IntegrationCard.svelte';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);
	const gh = $derived(data.github);
	const s3 = $derived(data.storage);

	type CardStatus = 'connected' | 'disconnected' | 'soon' | 'unavailable';
	function statusFor(key: string): CardStatus {
		if (key === 'github') return gh.active ? 'connected' : 'disconnected';
		if (key === 's3') return s3.active ? 'connected' : 'disconnected';
		if (key === 'gitlab') return 'soon';
		return 'disconnected'; // notification providers are configured per-project
	}

	// Which integration's config modal is open (a catalog key), or null.
	let openKey = $state<string | null>(null);
	const active = $derived(openKey ? descriptor(openKey) : undefined);

	function copy(text: string) {
		navigator.clipboard?.writeText(text);
	}
	function close() {
		openKey = null;
	}
	// Close the modal after a successful SAVE (but keep it open for a "test").
	const onSubmit = () => async ({ action, update, result }: any) => {
		await update();
		if (result.type === 'success' && !action.search.includes('test')) close();
	};
</script>

<svelte:head><title>Integrations · Admin · OpenTrack</title></svelte:head>

<div class="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
	<header class="mb-6">
		<h1 class="text-xl font-semibold tracking-tight">Integrations</h1>
		<p class="mt-0.5 text-sm text-neutral-500">
			Instance-level integrations. Pick one to configure it. Notification channels are then connected per project.
		</p>
	</header>

	{#each ADMIN_CATEGORY_ORDER as cat (cat)}
		<section class="mb-6">
			<h2 class="mb-1 text-sm font-semibold">{CATEGORY_META[cat].label}</h2>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each byCategory(cat) as d (d.key)}
					<IntegrationCard
						name={d.name}
						blurb={d.blurb}
						icon={d.icon}
						status={statusFor(d.key)}
						selected={openKey === d.key}
						onclick={() => (openKey = d.key)}
					/>
				{/each}
			</div>
		</section>
	{/each}
</div>

<Dialog
	bind:open={() => openKey !== null, (v) => { if (!v) close(); }}
	title={active?.name ?? ''}
	description={active?.blurb}
>
	{#if f?.error}<p class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">{f.error}</p>{/if}

	{#if openKey === 'github'}
		<form method="POST" action="?/saveGithub" use:enhance={onSubmit} class="max-h-[65vh] space-y-3 overflow-y-auto pr-0.5">
			<p class="text-sm text-neutral-500">
				Bidirectional issue sync via a GitHub App.
				<a href={data.urls.newApp} target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 text-brand-600 hover:underline"><ExternalLink size={12} /> Register a new App</a>, then paste its details.
			</p>
			<div class="space-y-1 rounded-lg bg-neutral-50 p-3 text-xs dark:bg-neutral-900">
				<p class="text-neutral-500">Use these URLs when registering the App:</p>
				<div class="flex items-center gap-2"><span class="w-16 text-neutral-400">Setup</span><code class="min-w-0 flex-1 truncate">{data.urls.setup}</code><button type="button" onclick={() => copy(data.urls.setup)} aria-label="Copy setup URL"><Copy size={12} /></button></div>
				<div class="flex items-center gap-2"><span class="w-16 text-neutral-400">Webhook</span><code class="min-w-0 flex-1 truncate">{data.urls.webhook}</code><button type="button" onclick={() => copy(data.urls.webhook)} aria-label="Copy webhook URL"><Copy size={12} /></button></div>
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
			<div class="flex justify-end gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
				<span class="mr-auto self-center text-xs text-neutral-400">Clear the App ID to disconnect.</span>
				<Button size="sm" variant="ghost" type="button" onclick={close}>Cancel</Button>
				<Button size="sm" variant="primary" type="submit">Save</Button>
			</div>
		</form>
	{:else if openKey === 's3'}
		<form method="POST" action="?/saveStorage" use:enhance={onSubmit} class="max-h-[65vh] space-y-3 overflow-y-auto pr-0.5">
			<div class="flex items-center gap-2 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500 dark:bg-neutral-900">
				{#if s3.active}<Cloud size={16} class="text-brand-600" /> S3 is the active backend for new uploads.
				{:else}<HardDrive size={16} /> Local disk is active. Configure + enable S3 below.{/if}
			</div>
			<p class="text-sm text-neutral-500">R2: region <code class="rounded bg-neutral-100 px-1 text-[11px] dark:bg-neutral-800">auto</code> + your account endpoint. MinIO: set the endpoint and enable path-style.</p>
			<div class="grid gap-3 sm:grid-cols-2">
				<Field label="Bucket"><Input name="bucket" value={s3.bucket} placeholder="opentrack" /></Field>
				<Field label="Region"><Input name="region" value={s3.region} placeholder="auto" /></Field>
			</div>
			<Field label="Endpoint" hint="Leave blank for AWS S3."><Input name="endpoint" value={s3.endpoint} placeholder="https://<account>.r2.cloudflarestorage.com" /></Field>
			<div class="grid gap-3 sm:grid-cols-2">
				<Field label="Access key ID"><Input name="accessKeyId" value={s3.accessKeyId} placeholder="access key id" /></Field>
				<Field label="Secret access key"><Input name="secretAccessKey" type="password" placeholder={s3.hasSecret ? '•••••• (leave blank to keep)' : 'secret access key'} /></Field>
			</div>
			<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="forcePathStyle" checked={s3.forcePathStyle} class="size-4 accent-brand-600" /> Force path-style URLs <span class="text-xs text-neutral-400">(MinIO)</span></label>
			<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="s3Enabled" checked={s3.s3Enabled} class="size-4 accent-brand-600" /> Use S3 for new uploads</label>
			{#if s3.configured}
				<p class="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">Switching only affects new uploads; existing files keep their backend.</p>
			{/if}
			<div class="flex items-center gap-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
				<button type="submit" formaction="?/testStorage" class="text-xs text-brand-600 hover:underline">Test connection</button>
				{#if f?.tested}<span class="flex items-center gap-1 text-xs text-green-600"><Check size={12} /> Connected</span>{/if}
				{#if f?.testError}<span class="flex items-center gap-1 text-xs text-red-600"><TriangleAlert size={12} /> {f.testError}</span>{/if}
				<div class="ml-auto flex gap-2">
					<Button size="sm" variant="ghost" type="button" onclick={close}>Cancel</Button>
					<Button size="sm" variant="primary" type="submit">Save</Button>
				</div>
			</div>
		</form>
	{:else if openKey === 'gitlab'}
		<p class="text-sm text-neutral-500">
			GitLab issue sync is scaffolded and coming soon. No instance-level setup is needed — projects will connect it with a project access token from their own Integrations tab.
		</p>
	{:else if active}
		<p class="text-sm text-neutral-500">
			{active.name} needs no instance-level setup. Connect it per project from the project’s <span class="font-medium">Settings → Integrations</span> tab by pasting an incoming-webhook URL.
		</p>
	{/if}
</Dialog>
