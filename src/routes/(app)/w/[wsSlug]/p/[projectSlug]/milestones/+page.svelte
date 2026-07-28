<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Milestone, Plus, Trash2, Check, RotateCcw, Pencil, GitBranch } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import ProjectPageHeader from '$lib/components/app/ProjectPageHeader.svelte';

	let { data } = $props();
	const jsonHeaders = { 'content-type': 'application/json' };

	let showForm = $state(false);
	let title = $state('');
	let description = $state('');
	let dueDate = $state('');
	let error = $state('');
	let busy = $state(false);

	// Inline edit state
	let editingId = $state<string | null>(null);
	let editTitle = $state('');
	let editDescription = $state('');
	let editDue = $state('');

	type M = (typeof data.milestones)[number];
	const open = $derived(data.milestones.filter((m) => m.state === 'open'));
	const closed = $derived(data.milestones.filter((m) => m.state === 'closed'));

	function fmtDate(d: string | Date | null) {
		return d ? new Date(d).toLocaleDateString() : null;
	}
	function toInputDate(d: string | Date | null) {
		return d ? new Date(d).toISOString().slice(0, 10) : '';
	}

	async function create() {
		const t = title.trim();
		if (!t) { error = 'Enter a title.'; return; }
		busy = true;
		error = '';
		const res = await fetch(`/api/projects/${data.projectId}/milestones`, {
			method: 'POST',
			headers: jsonHeaders,
			body: JSON.stringify({ title: t, description: description.trim() || null, dueDate: dueDate || null })
		});
		busy = false;
		if (res.ok) {
			title = ''; description = ''; dueDate = ''; showForm = false;
			await invalidateAll();
		} else {
			error = 'Could not create milestone.';
		}
	}

	function startEdit(m: M) {
		editingId = m.id;
		editTitle = m.title;
		editDescription = m.description ?? '';
		editDue = toInputDate(m.dueDate);
	}
	async function saveEdit(m: M) {
		const t = editTitle.trim();
		if (!t) return;
		await fetch(`/api/milestones/${m.id}`, {
			method: 'PATCH',
			headers: jsonHeaders,
			body: JSON.stringify({ title: t, description: editDescription.trim() || null, dueDate: editDue || null })
		});
		editingId = null;
		await invalidateAll();
	}
	async function setState(m: M, state: 'open' | 'closed') {
		await fetch(`/api/milestones/${m.id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ state }) });
		await invalidateAll();
	}
	async function remove(m: M) {
		if (!confirm(`Delete milestone "${m.title}"? Tickets will be detached (not deleted).`)) return;
		await fetch(`/api/milestones/${m.id}`, { method: 'DELETE' });
		await invalidateAll();
	}
</script>

<svelte:head><title>Milestones — {data.project.name}</title></svelte:head>

<div class="flex h-full flex-col">
	<ProjectPageHeader section="Milestones">
		{#snippet action()}
			{#if data.canManage && !showForm}
				<Button variant="accent" size="sm" onclick={() => (showForm = true)}><Plus size={15} /> New milestone</Button>
			{/if}
		{/snippet}
	</ProjectPageHeader>
	<div class="min-h-0 flex-1 overflow-y-auto">
		<div class="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
	{#if data.githubRepo}
		<p class="mb-4 flex items-center gap-1.5 font-mono text-[11px] text-neutral-400 dark:text-neutral-500"><GitBranch size={12} /> Synced with {data.githubRepo}</p>
	{/if}

	{#if showForm}
		<div class="pub-card mb-6 p-4">
			<div class="flex flex-col gap-3">
				<Input bind:value={title} placeholder="Milestone title" autofocus />
				<Textarea bind:value={description} placeholder="Description (optional)" rows={2} />
				<label class="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
					Due date <input type="date" bind:value={dueDate} class="rounded-lg border border-black/10 bg-white px-2 py-1 font-mono text-sm tabular-nums dark:border-white/10 dark:bg-neutral-900" />
				</label>
				{#if error}<p class="text-sm text-red-600">{error}</p>{/if}
				<div class="flex gap-2">
					<Button variant="accent" onclick={create} disabled={busy}>Create</Button>
					<Button variant="ghost" onclick={() => { showForm = false; error = ''; }}>Cancel</Button>
				</div>
			</div>
		</div>
	{/if}

	{#snippet milestoneRow(m: M, i: number)}
		{@const total = m.openCount + m.closedCount}
		{@const pct = total ? Math.round((m.closedCount / total) * 100) : 0}
		<div class="pub-card ot-rise p-4" style={`--rise-i:${i}`}>
			{#if editingId === m.id}
				<div class="flex flex-col gap-2">
					<Input bind:value={editTitle} />
					<Textarea bind:value={editDescription} rows={2} placeholder="Description (optional)" />
					<label class="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
						Due date <input type="date" bind:value={editDue} class="rounded-lg border border-black/10 bg-white px-2 py-1 font-mono text-sm tabular-nums dark:border-white/10 dark:bg-neutral-900" />
					</label>
					<div class="flex gap-2">
						<Button variant="accent" size="sm" onclick={() => saveEdit(m)}>Save</Button>
						<Button variant="ghost" size="sm" onclick={() => (editingId = null)}>Cancel</Button>
					</div>
				</div>
			{:else}
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<Milestone size={15} class="shrink-0 text-neutral-400" />
							<p class="font-display font-semibold tracking-tight">{m.title}</p>
							{#if m.githubMilestoneNumber}
								<a href={`https://github.com/${data.githubRepo}/milestone/${m.githubMilestoneNumber}`} target="_blank" rel="noreferrer" class="text-neutral-400 transition-colors hover:text-[var(--accent-fg)]" title="View on GitHub"><GitBranch size={13} /></a>
							{/if}
						</div>
						{#if m.description}<p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{m.description}</p>{/if}
						<div class="mt-2 flex items-center gap-3 font-mono text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500">
							{#if fmtDate(m.dueDate)}<span>due {fmtDate(m.dueDate)}</span>{/if}
							<span>{m.closedCount} closed · {m.openCount} open</span>
						</div>
						{#if total}
							<div class="mt-2.5 flex max-w-sm items-center gap-3">
								<div class="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
									<div class="h-full rounded-full transition-all duration-500" style={`width:${pct}%;background:var(--accent)`}></div>
								</div>
								<span class="shrink-0 font-mono text-[11px] tabular-nums text-neutral-400">{pct}%</span>
							</div>
						{/if}
					</div>
					{#if data.canManage}
						<div class="flex shrink-0 items-center gap-1">
							<button onclick={() => startEdit(m)} class="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-600 dark:hover:bg-white/10 dark:hover:text-neutral-300" aria-label="Edit"><Pencil size={14} /></button>
							{#if m.state === 'open'}
								<button onclick={() => setState(m, 'closed')} class="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-600 dark:hover:bg-white/10 dark:hover:text-neutral-300" aria-label="Close milestone"><Check size={14} /></button>
							{:else}
								<button onclick={() => setState(m, 'open')} class="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-600 dark:hover:bg-white/10 dark:hover:text-neutral-300" aria-label="Reopen milestone"><RotateCcw size={14} /></button>
							{/if}
							<button onclick={() => remove(m)} class="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30" aria-label="Delete"><Trash2 size={14} /></button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/snippet}

	{#if data.milestones.length}
		{#if open.length}
			<div class="space-y-3">
				{#each open as m, i (m.id)}{@render milestoneRow(m, i)}{/each}
			</div>
		{/if}
		{#if closed.length}
			<h2 class="pub-label mt-8 mb-3">Closed</h2>
			<div class="space-y-3 opacity-70">
				{#each closed as m, i (m.id)}{@render milestoneRow(m, open.length + i)}{/each}
			</div>
		{/if}
	{:else}
		<div class="rounded-2xl bg-black/[0.03] py-16 text-center text-sm text-neutral-400 dark:bg-white/[0.04]">
			No milestones yet.{#if data.canManage} Create one to group tickets and sync with GitHub.{/if}
		</div>
	{/if}
		</div>
	</div>
</div>
