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
	<h1 class="mono-display text-xl tracking-tight text-[var(--text)]">Create a project</h1>
	<p class="mt-0.5 text-[13px] text-[var(--dim)]">in {data.workspace.name}</p>

	<!-- Mode -->
	<div class="mt-6 grid grid-cols-2 gap-2">
		<button
			type="button"
			onclick={() => (mode = 'blank')}
			class={`focus-ring flex items-center gap-2 rounded-[3px] border px-3 py-2.5 text-[13px] transition-colors ${mode === 'blank' ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] font-medium text-[var(--text)]' : 'border-[var(--rule)] text-[var(--dim)] hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)]'}`}
		>
			<FilePlus2 size={16} /> Blank project
		</button>
		<button
			type="button"
			onclick={() => (mode = 'import')}
			class={`focus-ring flex items-center gap-2 rounded-[3px] border px-3 py-2.5 text-[13px] transition-colors ${mode === 'import' ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] font-medium text-[var(--text)]' : 'border-[var(--rule)] text-[var(--dim)] hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)]'}`}
		>
			<GitBranch size={16} /> Import from GitHub
		</button>
	</div>

	{#if mode === 'blank'}
		<form method="POST" action="?/createBlank" use:enhance class="mt-6 flex flex-col gap-5 border-t border-[var(--rule)] pt-6">
			<div class="flex items-end gap-3">
				<div class="flex flex-col gap-1.5">
					<span class="text-[13px] font-medium text-[var(--dim)]">Icon</span>
					<div class="flex items-center gap-2">
						<div class="grid size-9 shrink-0 place-items-center rounded-[3px] text-base font-bold text-white" style={`background:${color}`}>
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
							class="focus-ring grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-[var(--ground)] transition"
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
							class={`focus-ring flex-1 rounded-[3px] border px-3 py-2 text-[13px] capitalize transition-colors ${visibility === v ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] font-medium text-[var(--text)]' : 'border-[var(--rule)] text-[var(--dim)]'}`}
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
		<div class="mt-6 border-t border-[var(--rule)] pt-6">
			{#if !gh.configured}
				<div class="border border-[color-mix(in_srgb,var(--amber)_35%,transparent)] bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] p-4 text-[13px] text-[var(--amber)]">
					GitHub isn't configured on this instance yet.
					{#if data.user?.isAdmin}<a href="/admin/integrations" class="mono-focus font-medium underline">Configure it in Admin →</a>{/if}
				</div>
			{:else if !gh.connected}
				<div class="border border-[var(--rule)] p-4 text-[13px] text-[var(--dim)]">
					No GitHub account is connected to this workspace.
					<a href={`/w/${data.workspace.slug}/settings`} class="mono-focus font-medium text-[var(--accent)] hover:underline">Connect one in workspace settings →</a>
				</div>
			{:else if gh.repos.length === 0}
				<div class="border border-[var(--rule)] p-4 text-[13px] text-[var(--dim)]">
					No repositories are available. Make sure the GitHub App has access to the repos you want, then reload.
				</div>
			{:else}
				<div class="flex flex-col gap-4">
					<Field label="Repository" error={form?.importError}>
						<Select name="repo" bind:value={repo} options={gh.repos} placeholder="Choose a repository…" />
					</Field>
					<div class="border border-[var(--rule)] bg-[var(--raised)] p-3 text-[12px] text-[var(--dim)]">
						Imports the repo's <span class="font-medium text-[var(--text)]">name &amp; description</span>. Choose what else to bring in on the next step.
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
			<label class="flex items-center gap-2 text-[13px] text-[var(--text)]"><input type="checkbox" name="importIssues" checked class="size-4 accent-[var(--accent)]" /> Import issues</label>
			<label class="flex items-center gap-2 text-[13px] text-[var(--text)]"><input type="checkbox" name="importPrs" checked class="size-4 accent-[var(--accent)]" /> Import pull requests &amp; link them</label>
			<label class="flex items-center gap-2 text-[13px] text-[var(--text)]"><input type="checkbox" name="importReleases" checked class="size-4 accent-[var(--accent)]" /> Import releases</label>
			<label class="flex items-center gap-2 text-[13px] text-[var(--text)]"><input type="checkbox" name="importMilestones" checked class="size-4 accent-[var(--accent)]" /> Import milestones</label>
			<label class="flex items-center gap-2 text-[13px] text-[var(--text)]"><input type="checkbox" name="syncAssignees" checked class="size-4 accent-[var(--accent)]" /> Sync assignees to linked accounts</label>
			<label class="flex items-center gap-2 text-[13px] text-[var(--text)]"><input type="checkbox" name="syncPriority" checked class="size-4 accent-[var(--accent)]" /> Map <code class="data-mono rounded-[3px] bg-[var(--raised)] px-1 text-[11px] text-[var(--dim)]">priority: …</code> labels to priority</label>
		</div>

		<div>
			<p class="mb-1.5 text-[13px] font-medium text-[var(--text)]">Issue labels to import</p>
			{#if loadingLabels}
				<p class="text-[11px] text-[var(--faint)]">Loading labels…</p>
			{:else if repoLabels.length}
				<div class="mono-scroll max-h-40 space-y-1 overflow-y-auto border border-[var(--rule)] p-2">
					{#each repoLabels as l (l.name)}
						<label class="flex items-center gap-2 text-[13px] text-[var(--text)]">
							<input type="checkbox" name="issueLabel" value={l.name} checked class="size-4 accent-[var(--accent)]" />
							<span class="size-2.5 shrink-0 rounded-full" style={`background:${l.color}`}></span>
							<span class="truncate">{l.name}</span>
						</label>
					{/each}
				</div>
			{:else}
				<p class="text-[11px] text-[var(--faint)]">This repo has no labels.</p>
			{/if}
		</div>

		<div>
			<p class="text-[13px] font-medium text-[var(--text)]">Create progress labels</p>
			<p class="mb-1.5 text-[11px] text-[var(--faint)]">
				When a ticket enters a selected column, its linked GitHub issue gets a <code class="data-mono rounded-[3px] bg-[var(--raised)] px-1 text-[11px] text-[var(--dim)]">Status: …</code> label.
			</p>
			<div class="space-y-1">
				{#each DEFAULT_COLUMNS as c (c)}
					<label class="flex items-center gap-2 text-[13px] text-[var(--text)]">
						<input type="checkbox" name="progressColumn" value={c} class="size-4 accent-[var(--accent)]" />
						<span class="text-[var(--faint)]">Status:</span> {c}
					</label>
				{/each}
			</div>
		</div>

		<div class="flex justify-end gap-2 border-t border-[var(--rule)] pt-3">
			<Button variant="ghost" type="button" onclick={() => (configOpen = false)}>Cancel</Button>
			<Button variant="primary" type="submit" disabled={importing}>{importing ? 'Importing…' : 'Import'}</Button>
		</div>
	</form>
</Dialog>
