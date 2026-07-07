<script lang="ts">
	import { enhance } from '$app/forms';
	import BrandIcon from '$lib/components/integrations/BrandIcon.svelte';

	let { data, form } = $props();

	// Brand styling for built-in providers; custom providers get a neutral style.
	const brandClass: Record<string, string> = {
		github: 'bg-neutral-900 hover:bg-neutral-800 text-white',
		discord: 'bg-[#5865F2] hover:bg-[#4752c4] text-white',
		modrinth: 'bg-[#1bd96a] hover:bg-[#17b959] text-black'
	};

	const redirectParam = $derived(
		data.redirectTo && data.redirectTo !== '/'
			? `?redirect=${encodeURIComponent(data.redirectTo)}`
			: ''
	);

	let showAdmin = $state(false);
</script>

<svelte:head><title>Sign in · OpenTrack</title></svelte:head>

<main class="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-8 px-4 py-16 sm:px-6">
	<div class="text-center">
		<h1 class="text-2xl font-bold tracking-tight">Sign in to OpenTrack</h1>
		<p class="mt-1 text-sm text-neutral-500">Use a provider to comment, vote, and suggest.</p>
	</div>

	{#if data.oauthError}
		<p class="rounded-md bg-red-50 px-3 py-2 text-center text-sm text-red-600 dark:bg-red-950/40">{data.oauthError}</p>
	{/if}

	{#if data.providers.length > 0}
		<div class="flex flex-col gap-3">
			{#each data.providers as provider (provider.key)}
				<a
					href={`/auth/oauth/${provider.key}${redirectParam}`}
					class={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${brandClass[provider.key] ?? 'border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800'}`}
				>
					<BrandIcon name={provider.icon || provider.key} size={18} class="shrink-0" />
					Continue with {provider.label}
				</a>
			{/each}
		</div>
	{:else}
		<p class="rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-700 dark:bg-amber-950/40">
			No OAuth providers are configured yet.
		</p>
	{/if}

	<div class="border-t border-neutral-200 pt-4 dark:border-neutral-800">
		{#if showAdmin}
			<form method="POST" action="?/admin" use:enhance class="flex flex-col gap-3">
				<h2 class="text-sm font-semibold text-neutral-500">Admin sign in</h2>
				{#if form?.error}
					<p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">
						{form.error}
					</p>
				{/if}
				<input
					name="username"
					type="text"
					autocomplete="username"
					placeholder="Username"
					value={form?.username ?? ''}
					required
					class="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
				/>
				<input
					name="password"
					type="password"
					autocomplete="current-password"
					placeholder="Password"
					required
					class="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
				/>
				<input
					name="code"
					type="text"
					inputmode="numeric"
					autocomplete="one-time-code"
					placeholder="One-time code (if 2FA is on)"
					value=""
					class={`rounded-lg border bg-transparent px-3 py-2 text-sm dark:border-neutral-700 ${(form as any)?.needCode ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-neutral-300'}`}
				/>
				<button
					type="submit"
					class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
				>
					Sign in
				</button>
			</form>
		{:else}
			<button
				type="button"
				onclick={() => (showAdmin = true)}
				class="w-full text-center text-xs text-neutral-400 hover:text-neutral-600"
			>
				Admin sign in
			</button>
		{/if}
	</div>
</main>
