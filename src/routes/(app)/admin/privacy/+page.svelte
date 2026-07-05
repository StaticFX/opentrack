<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, Check, KeyRound, ExternalLink } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);

	const providerLabel: Record<string, string> = { github: 'GitHub', discord: 'Discord', modrinth: 'Modrinth' };

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
						<div class="flex-1"><Field label="Client ID"><Input name="clientId" value={p.clientId} placeholder="client id" /></Field></div>
						<div class="flex-1"><Field label="Client secret"><Input name="clientSecret" type="password" placeholder={p.hasSecret ? '•••••• (leave blank to keep)' : 'client secret'} /></Field></div>
					</div>
					<div class="mt-3 flex items-center gap-3">
						<Button size="sm" variant="primary" type="submit">Save</Button>
						{#if f?.savedOAuth === p.provider}<span class="text-sm text-green-600">Saved</span>{/if}
						<span class="text-xs text-neutral-400">Clear the Client ID to disable.</span>
					</div>
				</form>
			{/each}
		</div>
	</section>
</div>
