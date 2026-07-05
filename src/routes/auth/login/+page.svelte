<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const providerMeta: Record<string, { label: string; class: string }> = {
		github: { label: 'GitHub', class: 'bg-neutral-900 hover:bg-neutral-800 text-white' },
		discord: { label: 'Discord', class: 'bg-[#5865F2] hover:bg-[#4752c4] text-white' },
		modrinth: { label: 'Modrinth', class: 'bg-[#1bd96a] hover:bg-[#17b959] text-black' }
	};

	const redirectParam = $derived(
		data.redirectTo && data.redirectTo !== '/'
			? `?redirect=${encodeURIComponent(data.redirectTo)}`
			: ''
	);

	let showAdmin = $state(false);
</script>

<svelte:head><title>Sign in · OpenTrack</title></svelte:head>

<main class="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-8 px-6 py-16">
	<div class="text-center">
		<h1 class="text-2xl font-bold tracking-tight">Sign in to OpenTrack</h1>
		<p class="mt-1 text-sm text-neutral-500">Use a provider to comment, vote, and suggest.</p>
	</div>

	{#if data.providers.length > 0}
		<div class="flex flex-col gap-3">
			{#each data.providers as provider (provider)}
				<a
					href={`/auth/oauth/${provider}${redirectParam}`}
					class={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${providerMeta[provider]?.class ?? 'bg-neutral-800 text-white'}`}
				>
					Continue with {providerMeta[provider]?.label ?? provider}
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
					name="email"
					type="email"
					placeholder="admin@example.com"
					value={form?.email ?? ''}
					required
					class="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
				/>
				<input
					name="password"
					type="password"
					placeholder="Password"
					required
					class="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
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
