<script lang="ts">
	import AdminSidebar from '$lib/components/app/AdminSidebar.svelte';

	let { children } = $props();
</script>

<div class="flex h-screen min-w-0">
	<AdminSidebar />
	<div class="min-w-0 flex-1 overflow-y-auto">
		{@render children()}
	</div>
</div>
