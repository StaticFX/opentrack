<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check, GitBranch, FilePlus2 } from '@lucide/svelte';
	import { PALETTE, DEFAULT_COLOR } from '$lib/colors';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';

	let { data, form } = $props();
	let color = $state<string>(DEFAULT_COLOR);
	let icon = $state<string>('');
	let name = $state<string>(form?.name ?? '');
	let visibility = $state<'inherit' | 'public' | 'private'>('inherit');

	let mode = $state<'blank' | 'import'>('blank');
	let repo = $state<string>('');
	let importing = $state(false);
	const gh = $derived(data.github);

	// Import settings modal.
	let configOpen = $state(false);
	let loadingLabels = $state(false);
	let repoLabels = $state<Array<{ name: string; color: string }>>([]);
	// A freshly imported project gets the default board columns.
	const DEFAULT_COLUMNS = ['Backlog', 'Todo', 'In Progress', 'Done'];
	const repoName = $derived(gh.repos.find((r) => r.value === repo)?.label ?? '');

	async function openConfig() {
		if (!repo) return;
		configOpen = true;
		loadingLabels = true;
		repoLabels = [];
		try {
			const res = await fetch(
				`/api/workspaces/${data.workspace.slug}/github/repo-labels?repo=${encodeURIComponent(repo)}`
			);
			repoLabels = res.ok ? (await res.json()).labels : [];
		} finally {
			loadingLabels = false;
		}
	}
</script>

<svelte:head><title>New project · OpenTrack</title></svelte:head>

<div class="mx-auto max-w-lg px-4 py-8 sm:px-8 sm:py-12">
	<h1 class="text-xl font-semibold tracking-tight">Create a project</h1>
	<p class="mt-0.5 text-sm text-neutral-500">in {data.workspace.name}</p>

	<!-- Mode -->
	<div class="mt-6 grid grid-cols-2 gap-2">
		<button
			type="button"
			onclick={() => (mode = 'blank')}
			class={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${mode === 'blank' ? 'border-brand-500 bg-brand-50/50 font-medium dark:bg-brand-500/10' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900'}`}
		>
			<FilePlus2 size={16} /> Blank project
		</button>
		<button
			type="button"
			onclick={() => (mode = 'import')}
			class={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${mode === 'import' ? 'border-brand-500 bg-brand-50/50 font-medium dark:bg-brand-500/10' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900'}`}
		>
			<GitBranch size={16} /> Import from GitHub
		</button>
	</div>

	{#if mode === 'blank'}
		<form method="POST" action="?/createBlank" use:enhance class="mt-6 flex flex-col gap-5">
			<div class="flex items-end gap-3">
				<div class="flex flex-col gap-1.5">
					<span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Icon</span>
					<div class="flex items-center gap-2">
						<div class="grid size-9 shrink-0 place-items-center rounded-lg text-base font-bold text-white" style={`background:${color}`}>
							{#if icon}{icon}{:else}{(name || 'P').slice(0, 1).toUpperCase()}{/if}
						</div>
						<Input name="icon" bind:value={icon} placeholder="🚀" class="w-16 text-center text-lg" maxlength={8} />
					</div>
				</div>
				<div class="flex-1">
					<Field label="Name" error={form?.error}>
						<Input name="name" bind:value={name} placeholder="Client mod" required autofocus />
					</Field>
				</div>
			</div>

			<Field label="Description" hint="Optional">
				<Textarea name="description" rows={2} placeholder="What is this project about?" />
			</Field>

			<Field label="Color">
				<input type="hidden" name="color" value={color} />
				<div class="flex flex-wrap gap-2">
					{#each PALETTE as c (c)}
						<button
							type="button"
							onclick={() => (color = c)}
							class="grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-white transition dark:ring-offset-neutral-950"
							class:ring-2={color === c}
							style={`background:${c}; --tw-ring-color:${c}`}
							aria-label={`Pick ${c}`}
						>
							{#if color === c}<Check size={14} class="text-white" />{/if}
						</button>
					{/each}
				</div>
			</Field>

			<Field label="Visibility" hint="Inherit uses the workspace's visibility.">
				<input type="hidden" name="visibility" value={visibility} />
				<div class="flex gap-2">
					{#each ['inherit', 'public', 'private'] as v (v)}
						<button
							type="button"
							onclick={() => (visibility = v as typeof visibility)}
							class={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition ${visibility === v ? 'border-brand-500 bg-brand-50/50 font-medium dark:bg-brand-500/10' : 'border-neutral-200 dark:border-neutral-800'}`}
						>
							{v}
						</button>
					{/each}
				</div>
			</Field>

			<div class="flex gap-2">
				<Button variant="primary" type="submit">Create project</Button>
				<Button variant="ghost" href={`/w/${data.workspace.slug}`}>Cancel</Button>
			</div>
		</form>
	{:else}
		<!-- Import from GitHub -->
		<div class="mt-6">
			{#if !gh.configured}
				<div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
					GitHub isn't configured on this instance yet.
					{#if data.user?.isAdmin}<a href="/admin/integrations" class="font-medium underline">Configure it in Admin →</a>{/if}
				</div>
			{:else if !gh.connected}
				<div class="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-500 dark:border-neutral-800">
					No GitHub account is connected to this workspace.
					<a href={`/w/${data.workspace.slug}/settings`} class="font-medium text-brand-600 hover:underline">Connect one in workspace settings →</a>
				</div>
			{:else if gh.repos.length === 0}
				<div class="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-500 dark:border-neutral-800">
					No repositories are available. Make sure the GitHub App has access to the repos you want, then reload.
				</div>
			{:else}
				<div class="flex flex-col gap-4">
					<Field label="Repository" error={form?.importError}>
						<Select name="repo" bind:value={repo} options={gh.repos} placeholder="Choose a repository…" />
					</Field>
					<div class="rounded-lg border border-neutral-100 bg-neutral-50/60 p-3 text-xs text-neutral-500 dark:border-neutral-800/60 dark:bg-neutral-900/40">
						Imports the repo's <span class="font-medium">name &amp; description</span>. Choose what else to bring in on the next step.
					</div>
					<div class="flex gap-2">
						<Button variant="primary" disabled={!repo} onclick={openConfig}>Configure import…</Button>
						<Button variant="ghost" href={`/w/${data.workspace.slug}`}>Cancel</Button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Import settings modal -->
<Dialog bind:open={configOpen} title="Import from GitHub" description={repoName}>
	<form
		method="POST"
		action="?/importGithub"
		use:enhance={() => {
			importing = true;
			return async ({ update }) => { await update(); importing = false; };
		}}
		class="flex flex-col gap-4"
	>
		<input type="hidden" name="configured" value="1" />
		<input type="hidden" name="repo" value={repo} />

		<div class="space-y-2">
			<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="importIssues" checked class="size-4 accent-brand-600" /> Import issues</label>
			<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="importPrs" checked class="size-4 accent-brand-600" /> Import pull requests &amp; link them</label>
			<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="importReleases" checked class="size-4 accent-brand-600" /> Import releases</label>
			<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="importMilestones" checked class="size-4 accent-brand-600" /> Import milestones</label>
			<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="syncAssignees" checked class="size-4 accent-brand-600" /> Sync assignees to linked accounts</label>
			<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="syncPriority" checked class="size-4 accent-brand-600" /> Map <code class="rounded bg-neutral-100 px-1 text-[11px] dark:bg-neutral-800">priority: …</code> labels to priority</label>
		</div>

		<div>
			<p class="mb-1.5 text-sm font-medium">Issue labels to import</p>
			{#if loadingLabels}
				<p class="text-xs text-neutral-400">Loading labels…</p>
			{:else if repoLabels.length}
				<div class="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
					{#each repoLabels as l (l.name)}
						<label class="flex items-center gap-2 text-sm">
							<input type="checkbox" name="issueLabel" value={l.name} checked class="size-4 accent-brand-600" />
							<span class="size-2.5 shrink-0 rounded-full" style={`background:${l.color}`}></span>
							<span class="truncate">{l.name}</span>
						</label>
					{/each}
				</div>
			{:else}
				<p class="text-xs text-neutral-400">This repo has no labels.</p>
			{/if}
		</div>

		<div>
			<p class="text-sm font-medium">Create progress labels</p>
			<p class="mb-1.5 text-xs text-neutral-500">
				When a ticket enters a selected column, its linked GitHub issue gets a <code class="rounded bg-neutral-100 px-1 text-[11px] dark:bg-neutral-800">Status: …</code> label.
			</p>
			<div class="space-y-1">
				{#each DEFAULT_COLUMNS as c (c)}
					<label class="flex items-center gap-2 text-sm">
						<input type="checkbox" name="progressColumn" value={c} class="size-4 accent-brand-600" />
						<span class="text-neutral-500">Status:</span> {c}
					</label>
				{/each}
			</div>
		</div>

		<div class="flex justify-end gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
			<Button variant="ghost" type="button" onclick={() => (configOpen = false)}>Cancel</Button>
			<Button variant="primary" type="submit" disabled={importing}>{importing ? 'Importing…' : 'Import'}</Button>
		</div>
	</form>
</Dialog>
