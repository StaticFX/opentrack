<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<svelte:head><title>Redeem invite · OpenTrack</title></svelte:head>

<main class="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-6 px-4 py-16 sm:px-6">
	<div class="text-center">
		<h1 class="text-2xl font-bold tracking-tight">Redeem an invite</h1>
		<p class="mt-1 text-sm text-neutral-500">
			Enter the code an admin gave you to unlock internal access.
		</p>
	</div>

	<form method="POST" use:enhance class="flex flex-col gap-3">
		{#if form?.error}
			<p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">
				{form.error}
			</p>
		{/if}
		<input
			name="code"
			placeholder="ABCD-EFGH-IJKL-MNOP"
			value={form?.code ?? data.prefill}
			required
			autocomplete="off"
			class="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-center font-mono tracking-wider uppercase dark:border-neutral-700"
		/>
		<button
			type="submit"
			class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
		>
			Redeem
		</button>
	</form>
</main>
