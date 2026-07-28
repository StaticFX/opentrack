<script lang="ts">
	// The app speaks the same three type voices as the public pages, so the
	// faces are loaded here too (the public layout loads its own copy).
	import '@fontsource-variable/instrument-sans';
	import '@fontsource-variable/bricolage-grotesque/opsz.css';
	import '@fontsource-variable/jetbrains-mono';
	import sansUrl from '@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2?url';
	import displayUrl from '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2?url';
	import { Menu } from '@lucide/svelte';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import CommandPalette from '$lib/components/app/CommandPalette.svelte';
	import Sidebar from '$lib/components/app/Sidebar.svelte';

	let { children } = $props();

	// Off-canvas sidebar for narrow viewports. Closes automatically on navigation.
	let drawerOpen = $state(false);
	afterNavigate(() => (drawerOpen = false));

	const pd = $derived(page.data as Record<string, unknown>);
	const ws = $derived(pd.workspace as { name: string } | undefined);
	const proj = $derived(pd.project as { name: string; color?: string | null } | undefined);
	const barTitle = $derived(proj?.name ?? ws?.name ?? 'OpenTrack');
</script>

<svelte:head>
	<link rel="preload" as="font" type="font/woff2" href={sansUrl} crossorigin="anonymous" />
	<link rel="preload" as="font" type="font/woff2" href={displayUrl} crossorigin="anonymous" />
</svelte:head>

<!-- Accent scope: on project routes every accent token (--accent-soft, --accent-solid, …)
     resolves to the project's colour — for the rail and the content panel alike.
     Elsewhere it falls back to brand orange. -->
<div
	class="accent-scope flex h-screen overflow-hidden font-sans lg:gap-3 lg:p-3"
	style={`--accent:${proj?.color || 'var(--color-brand-600)'};background:var(--ot-ground)`}
>
	<!-- Mobile drawer backdrop -->
	{#if drawerOpen}
		<button
			aria-label="Close menu"
			class="fixed inset-0 z-40 bg-neutral-950/40 backdrop-blur-[2px] lg:hidden"
			onclick={() => (drawerOpen = false)}
		></button>
	{/if}

	<Sidebar open={drawerOpen} onnavigate={() => (drawerOpen = false)} />

	<!-- Content panel floats on the ground as a rounded surface (desktop). -->
	<div
		class="flex min-w-0 flex-1 flex-col overflow-hidden bg-neutral-100 lg:rounded-2xl lg:shadow-[var(--ot-shadow-float)] lg:ring-1 lg:ring-black/5 dark:bg-neutral-900 dark:lg:ring-white/5"
	>
		<!-- Mobile top bar (hidden on lg where the sidebar is always visible) -->
		<header
			class="flex h-12 shrink-0 items-center gap-2 border-b border-black/5 px-3 lg:hidden dark:border-white/8"
		>
			<button
				type="button"
				onclick={() => (drawerOpen = true)}
				class="-ml-1 rounded-md p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
				aria-label="Open menu"
			>
				<Menu size={20} />
			</button>
			<span class="min-w-0 flex-1 truncate font-display text-[15px] font-semibold tracking-tight">{barTitle}</span>
		</header>

		<main class="min-w-0 flex-1 overflow-y-auto">
			{@render children()}
		</main>
	</div>
</div>
<CommandPalette />
