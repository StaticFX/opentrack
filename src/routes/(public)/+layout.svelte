<script lang="ts">
	import { LayoutDashboard } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';

	let { data, children } = $props();

	// Two-char badge derived from the site name (uppercase letters/digits, else first two).
	const siteBadge = $derived(
		(data.siteName.match(/[A-Z0-9]/g)?.slice(0, 2).join('') || data.siteName.slice(0, 2)).toUpperCase()
	);
</script>

<div class="flex min-h-screen flex-col bg-white dark:bg-neutral-950">
	<header class="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
		<div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
			{#if data.brand}
				<a href={`/${data.brand.slug}`} class="flex items-center gap-2">
					{#if data.brand.avatarUrl}
						<img src={data.brand.avatarUrl} alt="" class="size-7 rounded-lg object-cover" />
					{:else}
						<span class="grid size-7 place-items-center rounded-lg text-xs font-bold text-white" style={`background:${data.brand.color || 'var(--color-brand-600)'}`}>
							{#if data.brand.icon}{data.brand.icon}{:else}{data.brand.name.slice(0, 1).toUpperCase()}{/if}
						</span>
					{/if}
					<span class="font-semibold tracking-tight">{data.brand.name}</span>
				</a>
			{:else}
				<a href="/" class="flex items-center gap-2">
					<span class="grid size-7 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">{siteBadge}</span>
					<span class="font-semibold tracking-tight">{data.siteName}</span>
				</a>
			{/if}
			<div class="flex items-center gap-3 text-sm">
				{#if data.user}
					<a href="/dashboard" class="flex items-center gap-1.5 text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
						<LayoutDashboard size={15} /> Dashboard
					</a>
					<div class="grid size-7 place-items-center rounded-full bg-neutral-200 text-xs font-semibold dark:bg-neutral-700" title={data.user.displayName}>
						{data.user.displayName.slice(0, 1).toUpperCase()}
					</div>
				{:else}
					<Button size="sm" variant="primary" href="/auth/login">Sign in</Button>
				{/if}
			</div>
		</div>
	</header>

	<div class="flex-1">
		{@render children()}
	</div>

	<footer class="border-t border-neutral-200 py-6 text-center text-xs text-neutral-400 dark:border-neutral-800">
		Powered by OpenTrack
	</footer>
</div>
