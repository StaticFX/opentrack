<script lang="ts">
	import { enhance } from '$app/forms';
	import { Tag } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import ProjectPageHeader from '$lib/components/app/ProjectPageHeader.svelte';

	let { data, form } = $props();
	const base = $derived(`/w/${data.workspace?.slug ?? ''}/p/${data.project.slug}`);
	let showForm = $state(false);
</script>

<svelte:head><title>Releases — {data.project.name}</title></svelte:head>

<div class="flex h-full flex-col">
	<ProjectPageHeader section="Releases">
		{#snippet action()}
			{#if showForm}
				<form method="POST" action="?/create" use:enhance class="flex items-end gap-2">
					<Field label=""><Input name="version" placeholder="v1.2.0" required autofocus class="w-32 font-mono" /></Field>
					<Button variant="accent" size="sm" type="submit">Create</Button>
					<Button variant="ghost" size="sm" type="button" onclick={() => (showForm = false)}>Cancel</Button>
				</form>
			{:else}
				<Button variant="accent" size="sm" onclick={() => (showForm = true)}><Tag size={15} /> New release</Button>
			{/if}
		{/snippet}
	</ProjectPageHeader>
	<div class="min-h-0 flex-1 overflow-y-auto">
		<div class="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
	{#if form?.error}<p class="mb-3 text-sm text-red-600">{form.error}</p>{/if}

	{#if data.releases.length}
		<div class="space-y-2.5">
			{#each data.releases as r, i (r.id)}
				<a href={`${base}/releases/${r.id}`} class="pub-card ot-rise group flex items-center gap-3.5 p-3.5 transition duration-150 hover:-translate-y-0.5" style={`--rise-i:${i}`}>
					<span class="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-fg)]"><Tag size={15} /></span>
					<span class="min-w-0 flex-1">
						<span class="flex items-baseline gap-2">
							<span class="font-mono text-sm font-semibold tabular-nums group-hover:text-[var(--accent-fg)]">{r.version}</span>
							{#if r.name}<span class="truncate text-sm text-neutral-500 dark:text-neutral-400">{r.name}</span>{/if}
						</span>
						{#if r.releasedAt}<span class="mt-0.5 block font-mono text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500">{new Date(r.releasedAt).toLocaleDateString()}</span>{/if}
					</span>
					<span class="shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium {r.status === 'published' ? 'text-green-700 dark:text-green-300' : 'text-neutral-500 dark:text-neutral-400'}" style="background:color-mix(in oklab, currentColor 12%, transparent)">{r.status}</span>
				</a>
			{/each}
		</div>
	{:else}
		<div class="rounded-2xl bg-black/[0.03] py-16 text-center text-sm text-neutral-400 dark:bg-white/[0.04]">
			No releases yet. Create one to start a public changelog.
		</div>
	{/if}
		</div>
	</div>
</div>
