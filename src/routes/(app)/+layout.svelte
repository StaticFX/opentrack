<script lang="ts">
	import Sidebar from '$lib/components/app/Sidebar.svelte';

	let { children } = $props();
</script>

<div class="flex h-screen overflow-hidden bg-white dark:bg-neutral-950">
	<Sidebar />
	<main class="min-w-0 flex-1 overflow-y-auto">
		{@render children()}
	</main>
</div>
