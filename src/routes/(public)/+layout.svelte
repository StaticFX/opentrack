<script lang="ts">
	import '@fontsource-variable/instrument-sans';
	import '@fontsource-variable/bricolage-grotesque/opsz.css';
	import '@fontsource-variable/jetbrains-mono';
	import sansUrl from '@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2?url';
	import displayUrl from '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2?url';
	import { LayoutDashboard } from '@lucide/svelte';
	import { onNavigate } from '$app/navigation';
	import Button from '$lib/components/ui/Button.svelte';
	import LiveRegion from '$lib/components/public/LiveRegion.svelte';
	import ThemeToggle from '$lib/components/public/ThemeToggle.svelte';

	let { data, children } = $props();

	// Cross-page morphs via the View Transitions API. Feature-checked; skipped
	// for reduced motion. Public pages only — the internal app stays static.
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	// Two-char badge derived from the site name (uppercase letters/digits, else first two).
	const siteBadge = $derived(
		(data.siteName.match(/[A-Z0-9]/g)?.slice(0, 2).join('') || data.siteName.slice(0, 2)).toUpperCase()
	);
</script>

<svelte:head>
	<link rel="preload" as="font" type="font/woff2" href={sansUrl} crossorigin="anonymous" />
	<link rel="preload" as="font" type="font/woff2" href={displayUrl} crossorigin="anonymous" />
</svelte:head>

<div class="flex min-h-screen flex-col font-sans" style="background:var(--ot-ground)">
	<LiveRegion />

	<header
		class="sticky top-0 z-30 border-b border-black/5 bg-white/70 backdrop-blur-md dark:border-white/5 dark:bg-neutral-900/70"
		style="view-transition-name: pub-header"
	>
		<div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
			{#if data.brand}
				<a href={`/${data.brand.slug}`} class="group flex items-center gap-2.5">
					{#if data.brand.avatarUrl}
						<img src={data.brand.avatarUrl} alt="" class="size-8 rounded-xl object-cover shadow-sm" />
					{:else}
						<span
							class="grid size-8 place-items-center rounded-xl text-sm font-bold text-white shadow-sm"
							style={`background:${data.brand.color || 'var(--color-brand-600)'}`}
						>
							{#if data.brand.icon}{data.brand.icon}{:else}{data.brand.name.slice(0, 1).toUpperCase()}{/if}
						</span>
					{/if}
					<span class="font-display font-semibold tracking-tight">{data.brand.name}</span>
				</a>
			{:else}
				<a href="/" class="group flex items-center gap-2.5">
					<span class="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white shadow-sm">{siteBadge}</span>
					<span class="font-display font-semibold tracking-tight">{data.siteName}</span>
				</a>
			{/if}

			<div class="flex items-center gap-2 text-sm">
				<ThemeToggle />
				{#if data.user}
					<a
						href="/dashboard"
						class="hidden items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-neutral-600 transition-colors hover:bg-black/5 hover:text-neutral-900 sm:flex dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
					>
						<LayoutDashboard size={15} /> Dashboard
					</a>
					<a href={`/u/${data.user.username}`} title={data.user.displayName} class="shrink-0">
						{#if data.user.avatarUrl}
							<img src={data.user.avatarUrl} alt={data.user.displayName} class="size-8 rounded-full object-cover ring-2 ring-white dark:ring-neutral-700" />
						{:else}
							<span class="grid size-8 place-items-center rounded-full bg-neutral-200 text-xs font-semibold dark:bg-neutral-700">
								{data.user.displayName.slice(0, 1).toUpperCase()}
							</span>
						{/if}
					</a>
				{:else}
					<Button size="sm" variant="primary" href="/auth/login" class="rounded-full px-4">Sign in</Button>
				{/if}
			</div>
		</div>
	</header>

	<div class="flex-1">
		{@render children()}
	</div>

	<footer class="mt-12 border-t border-black/5 dark:border-white/5" style="view-transition-name: pub-footer">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-6">
			<div class="flex items-center gap-4 font-mono text-[11px] text-neutral-400 dark:text-neutral-500">
				{#if data.brand}<span>{data.brand.name}</span>{:else}<span>{data.siteName}</span>{/if}
			</div>
			<a href="https://github.com/StaticFX/opentrack" class="group flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
				Powered by
				<span class="inline-grid size-4 place-items-center rounded bg-gradient-to-br from-brand-400 to-brand-600 text-[7px] font-bold text-white">OT</span>
				<span class="font-semibold text-neutral-500 group-hover:text-brand-600 dark:text-neutral-400 dark:group-hover:text-brand-400">OpenTrack</span>
			</a>
		</div>
	</footer>
</div>
