<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, Check, GitBranch, ExternalLink } from '@lucide/svelte';
	import { CATEGORY_META, CATEGORY_ORDER, byCategory, descriptor } from '$lib/integrations/catalog';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import IntegrationCard from '$lib/components/integrations/IntegrationCard.svelte';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);
	const gh = $derived(data.github);

	type CardStatus = 'connected' | 'disconnected' | 'soon' | 'unavailable';
	function statusFor(key: string): CardStatus {
		if (key === 'github') return gh.active ? 'connected' : 'disconnected';
		if (key === 'gitlab') return 'soon';
		return 'disconnected'; // notification providers are configured per-project
	}

	let selected = $state<string>('github');
	const selectedDesc = $derived(descriptor(selected));

	function copy(text: string) {
		navigator.clipboard?.writeText(text);
	}
</script>

<svelte:head><title>Integrations · Admin · OpenTrack</title></svelte:head>

<div class="mx-auto max-w-2xl px-8 py-8">
	<header class="mb-6">
		<h1 class="text-xl font-semibold tracking-tight">Integrations</h1>
		<p class="mt-0.5 text-sm text-neutral-500">
			Set up the integrations available to every project on this instance. Notification channels are then connected per project.
		</p>
	</header>

	{#each CATEGORY_ORDER as cat (cat)}
		<section class="mb-6">
			<h2 class="mb-1 text-sm font-semibold">{CATEGORY_META[cat].label}</h2>
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

	{#if selectedDesc}
		<section class="mt-2 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
			{#if selected === 'github'}
				<h2 class="flex items-center gap-2 text-sm font-semibold">
					<GitBranch size={15} /> GitHub App
					{#if gh.active}
						<span class="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300"><Check size={11} /> Connected</span>
					{:else}
						<span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500 dark:bg-neutral-800">Not connected</span>
					{/if}
				</h2>
				<p class="mt-1 mb-3 text-sm text-neutral-500">
					Bidirectional issue sync via a GitHub App.
					<a href={data.urls.newApp} target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 text-brand-600 hover:underline">
						<ExternalLink size={12} /> Register a new App
					</a>, then paste its details below.
				</p>

				<div class="mt-2 mb-4 space-y-1 rounded-lg bg-neutral-50 p-3 text-xs dark:bg-neutral-900">
					<p class="text-neutral-500">When registering the GitHub App, use these URLs:</p>
					<div class="flex items-center gap-2"><span class="w-16 text-neutral-400">Setup</span><code class="min-w-0 flex-1 truncate">{data.urls.setup}</code><button type="button" onclick={() => copy(data.urls.setup)} aria-label="Copy setup URL"><Copy size={12} /></button></div>
					<div class="flex items-center gap-2"><span class="w-16 text-neutral-400">Webhook</span><code class="min-w-0 flex-1 truncate">{data.urls.webhook}</code><button type="button" onclick={() => copy(data.urls.webhook)} aria-label="Copy webhook URL"><Copy size={12} /></button></div>
				</div>

				<form method="POST" action="?/saveGithub" use:enhance class="flex flex-col gap-3">
					<div class="flex gap-3">
						<div class="flex-1"><Field label="App ID"><Input name="appId" value={gh.appId} placeholder="123456" /></Field></div>
						<div class="flex-1"><Field label="App slug" hint="from the app URL"><Input name="slug" value={gh.slug} placeholder="my-tracker" /></Field></div>
					</div>
					<Field label="Private key (.pem)" hint={gh.hasPrivateKey ? 'Stored. Paste a new key to replace it.' : 'Paste the full PEM contents.'}>
						<Textarea name="privateKey" rows={4} placeholder={gh.hasPrivateKey ? '•••••• (leave blank to keep)' : '-----BEGIN RSA PRIVATE KEY-----'} />
					</Field>
					<div class="flex gap-3">
						<div class="flex-1"><Field label="Webhook secret"><Input name="webhookSecret" type="password" placeholder={gh.hasWebhookSecret ? '•••••• (keep)' : 'secret'} /></Field></div>
						<div class="flex-1"><Field label="OAuth client ID"><Input name="clientId" value={gh.clientId} placeholder="optional" /></Field></div>
						<div class="flex-1"><Field label="OAuth client secret"><Input name="clientSecret" type="password" placeholder={gh.hasClientSecret ? '•••••• (keep)' : 'optional'} /></Field></div>
					</div>
					<div class="flex items-center gap-3">
						<Button variant="primary" type="submit">Save GitHub App</Button>
						{#if f?.savedGithub}<span class="text-sm text-green-600">Saved</span>{/if}
						<span class="text-xs text-neutral-400">Clear the App ID to disconnect.</span>
					</div>
				</form>
			{:else if selected === 'gitlab'}
				<h2 class="text-sm font-semibold">{selectedDesc.name}</h2>
				<p class="mt-1 text-sm text-neutral-500">
					GitLab issue sync is scaffolded and coming soon. No instance-level setup is needed — projects will connect it with a project access token from their own Integrations tab.
				</p>
			{:else}
				<h2 class="text-sm font-semibold">{selectedDesc.name}</h2>
				<p class="mt-1 text-sm text-neutral-500">
					{selectedDesc.name} needs no instance-level setup. Connect it per project from the project’s
					<span class="font-medium">Settings → Integrations</span> tab by pasting an incoming-webhook URL.
				</p>
			{/if}
		</section>
	{/if}
</div>
