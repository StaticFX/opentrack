<script lang="ts">
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
	const proj = $derived(pd.project as { name: string } | undefined);
	const barTitle = $derived(proj?.name ?? ws?.name ?? 'OpenTrack');
</script>

<div class="flex h-screen overflow-hidden bg-white dark:bg-neutral-950">
	<!-- Mobile drawer backdrop -->
	{#if drawerOpen}
		<button
			aria-label="Close menu"
			class="fixed inset-0 z-40 bg-neutral-950/40 backdrop-blur-[2px] lg:hidden"
			onclick={() => (drawerOpen = false)}
		></button>
	{/if}

	<Sidebar open={drawerOpen} onnavigate={() => (drawerOpen = false)} />

	<div class="flex min-w-0 flex-1 flex-col">
		<!-- Mobile top bar (hidden on lg where the sidebar is always visible) -->
		<header
			class="flex h-12 shrink-0 items-center gap-2 border-b border-neutral-200 px-3 lg:hidden dark:border-neutral-800"
		>
			<button
				type="button"
				onclick={() => (drawerOpen = true)}
				class="-ml-1 rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
				aria-label="Open menu"
			>
				<Menu size={20} />
			</button>
			<span class="min-w-0 flex-1 truncate text-sm font-semibold">{barTitle}</span>
		</header>

		<main class="min-w-0 flex-1 overflow-y-auto">
			{@render children()}
		</main>
	</div>
</div>
<CommandPalette />
