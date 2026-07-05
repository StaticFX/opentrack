<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Link2, Check, X } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';

	let { data } = $props();
	const user = $derived(data.user as { displayName: string; email: string | null; avatarUrl: string | null });

	const builtinLabel: Record<string, string> = { github: 'GitHub', discord: 'Discord', modrinth: 'Modrinth' };
	const isUrl = (s: string | null) => !!s && /^https?:\/\//.test(s);

	const enabledByKey = $derived(new Map(data.enabledProviders.map((p) => [p.key, p])));
	const linkedByKey = $derived(new Map(data.linked.map((l) => [l.provider, l])));
	// Every provider you can connect, plus any you've already linked.
	const providerKeys = $derived([
		...new Set([...data.enabledProviders.map((p) => p.key), ...data.linked.map((l) => l.provider)])
	]);
	const meta = (key: string) =>
		enabledByKey.get(key) ?? { key, label: builtinLabel[key] ?? key, icon: null };

	// ?linked=github (success) | ?linked=taken (already on another account)
	const linkedFlag = $derived(page.url.searchParams.get('linked'));
</script>

<svelte:head><title>Account · OpenTrack</title></svelte:head>

<div class="mx-auto max-w-2xl px-8 py-8">
	<header class="mb-6">
		<h1 class="text-xl font-semibold tracking-tight">Account</h1>
		<p class="mt-0.5 text-sm text-neutral-500">Your profile and connected accounts.</p>
	</header>

	<!-- Profile -->
	<section class="mb-6 flex items-center gap-3 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		{#if user.avatarUrl}
			<img src={user.avatarUrl} alt="" class="size-11 rounded-full" />
		{:else}
			<div class="grid size-11 place-items-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-200">
				{user.displayName.slice(0, 1).toUpperCase()}
			</div>
		{/if}
		<div>
			<p class="font-medium">{user.displayName}{#if data.isAdmin}<span class="ml-2 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">Admin</span>{/if}</p>
			{#if user.email}<p class="text-sm text-neutral-500">{user.email}</p>{/if}
		</div>
	</section>

	<!-- Connected accounts -->
	<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="flex items-center gap-2 text-sm font-semibold"><Link2 size={15} /> Connected accounts</h2>
		<p class="mt-1 mb-4 text-sm text-neutral-500">Link a provider to sign in with it and show your identity.</p>

		{#if linkedFlag === 'taken'}
			<p class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">That account is already linked to a different user.</p>
		{:else if linkedFlag}
			<p class="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-300">{builtinLabel[linkedFlag] ?? linkedFlag} account connected.</p>
		{/if}

		<div class="space-y-3">
			{#each providerKeys as key (key)}
				{@const p = meta(key)}
				{@const linked = linkedByKey.get(key)}
				{@const enabled = enabledByKey.has(key)}
				<div class="flex items-center gap-3 rounded-lg border border-neutral-100 p-3 dark:border-neutral-800/60">
					{#if isUrl(p.icon)}
						<img src={p.icon} alt="" class="size-5 shrink-0" />
					{:else if p.icon}
						<span class="grid size-5 shrink-0 place-items-center text-base leading-none">{p.icon}</span>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium">{p.label}</p>
						{#if linked}
							<p class="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"><Check size={12} /> Connected{#if linked.providerUsername} as @{linked.providerUsername}{/if}</p>
						{:else if enabled}
							<p class="text-xs text-neutral-400">Not connected</p>
						{:else}
							<p class="text-xs text-neutral-400">Not available on this instance</p>
						{/if}
					</div>

					{#if linked}
						<form method="POST" action="?/unlink" use:enhance>
							<input type="hidden" name="provider" value={key} />
							<Button size="sm" variant="ghost" type="submit" class="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"><X size={14} /> Disconnect</Button>
						</form>
					{:else if enabled}
						<Button size="sm" variant="default" href={`/auth/oauth/${key}?link=1&redirect=/account`}>Connect</Button>
					{/if}
				</div>
			{:else}
				<p class="text-sm text-neutral-400">No login providers are configured on this instance.</p>
			{/each}
		</div>

		{#if data.isAdmin}
			<p class="mt-4 text-xs text-neutral-500">
				Configure login providers in
				<a href="/admin/privacy" class="font-medium text-brand-600 hover:underline">Admin → Privacy</a> — including custom OAuth providers like Google.
			</p>
		{/if}
	</section>
</div>
