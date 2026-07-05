<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { Tag, ArrowLeft } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';

	let { data, form } = $props();
	const base = $derived(`/w/${page.params.wsSlug}/p/${page.params.projectSlug}`);
	let showForm = $state(false);
</script>

<svelte:head><title>Releases — {data.project.name}</title></svelte:head>

<div class="mx-auto max-w-3xl px-8 py-8">
	<a href={`${base}`} class="mb-4 inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-600"><ArrowLeft size={14} /> Board</a>
	<header class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-semibold tracking-tight">Releases</h1>
		{#if showForm}
			<form method="POST" action="?/create" use:enhance class="flex items-end gap-2">
				<Field label=""><Input name="version" placeholder="v1.2.0" required autofocus class="w-32" /></Field>
				<Button variant="primary" type="submit">Create</Button>
				<Button variant="ghost" type="button" onclick={() => (showForm = false)}>Cancel</Button>
			</form>
		{:else}
			<Button variant="primary" onclick={() => (showForm = true)}><Tag size={15} /> New release</Button>
		{/if}
	</header>
	{#if form?.error}<p class="mb-3 text-sm text-red-600">{form.error}</p>{/if}

	{#if data.releases.length}
		<div class="divide-y divide-neutral-100 dark:divide-neutral-800">
			{#each data.releases as r (r.id)}
				<a href={`${base}/releases/${r.id}`} class="flex items-center justify-between py-3 hover:opacity-80">
					<div class="flex items-center gap-3">
						<Tag size={16} class="text-neutral-400" />
						<div>
							<p class="font-medium">{r.version}{#if r.name} — {r.name}{/if}</p>
							{#if r.releasedAt}<p class="text-xs text-neutral-400">{new Date(r.releasedAt).toLocaleDateString()}</p>{/if}
						</div>
					</div>
					<span class="rounded-full px-2 py-0.5 text-[11px] font-medium {r.status === 'published' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'}">{r.status}</span>
				</a>
			{/each}
		</div>
	{:else}
		<div class="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-400 dark:border-neutral-700">No releases yet.</div>
	{/if}
</div>
