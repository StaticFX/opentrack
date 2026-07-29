<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Milestone, Plus, Trash2, Check, RotateCcw, Pencil, GitBranch } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import EmptyStateApp from '$lib/components/ui/EmptyStateApp.svelte';
	import ViewHeader, { type Crumb } from '$lib/components/app/ViewHeader.svelte';
	import { PROJECT_NAV } from '$lib/projectNav';
	import { dueMeta } from '$lib/time';

	let { data } = $props();
	const jsonHeaders = { 'content-type': 'application/json' };

	const wsSlug = $derived(data.workspace.slug);
	const projSlug = $derived(data.project.slug);
	const base = $derived(`/w/${wsSlug}/p/${projSlug}`);
	const firstBoard = $derived(data.boards[0]);

	const crumbs = $derived<Crumb[]>([
		{
			label: data.project.name,
			href: base,
			dot: data.project.color ?? undefined,
			menu:
				(data.projects?.length ?? 0) > 1
					? data.projects.map((p) => ({ label: p.name, href: `/w/${wsSlug}/p/${p.slug}`, current: p.slug === projSlug }))
					: undefined
		},
		{
			label: 'Milestones',
			menu: [
				...data.boards.map((b) => ({ label: b.name, href: `${base}/b/${b.id}` })),
				...PROJECT_NAV.filter((i) => !i.external && (!i.manageOnly || data.canManage)).map((i) => ({
					label: i.label,
					href: i.href(wsSlug, projSlug),
					current: i.key === 'milestones'
				}))
			]
		}
	]);

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

	// Tier-2 delete confirm — the milestone DELETE is a plain REST call (no
	// form action to post to), so this wraps `remove()` in a Dialog rather
	// than the form-posting ConfirmDialog primitive.
	let confirmOpen = $state(false);
	let pendingDelete = $state<M | null>(null);

	type M = (typeof data.milestones)[number];
	const open = $derived(data.milestones.filter((m) => m.state === 'open'));
	const closed = $derived(data.milestones.filter((m) => m.state === 'closed'));

	function toInputDate(d: string | Date | null) {
		return d ? new Date(d).toISOString().slice(0, 10) : '';
	}

	async function create() {
		const t = title.trim();
		if (!t) {
			error = 'Enter a title.';
			return;
		}
		busy = true;
		error = '';
		const res = await fetch(`/api/projects/${data.projectId}/milestones`, {
			method: 'POST',
			headers: jsonHeaders,
			body: JSON.stringify({ title: t, description: description.trim() || null, dueDate: dueDate || null })
		});
		busy = false;
		if (res.ok) {
			title = '';
			description = '';
			dueDate = '';
			showForm = false;
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
	function requestRemove(m: M) {
		pendingDelete = m;
		confirmOpen = true;
	}
	async function confirmRemove() {
		if (!pendingDelete) return;
		await fetch(`/api/milestones/${pendingDelete.id}`, { method: 'DELETE' });
		confirmOpen = false;
		pendingDelete = null;
		await invalidateAll();
	}
</script>

<svelte:head><title>Milestones · {data.project.name} · OpenTrack</title></svelte:head>

<ViewHeader {crumbs} live={{ text: `${open.length} in flight` }} tabs>
	{#snippet actions()}
		{#if data.canManage && !showForm}
			<Button variant="accent" size="sm" onclick={() => (showForm = true)}><Plus size={15} /> New milestone</Button>
		{/if}
	{/snippet}
</ViewHeader>

<div class="view-5xl">
	{#if data.githubRepo}
		<p class="mb-4 flex items-center gap-1.5 text-[13px] text-[var(--faint)]"><GitBranch size={12} /> Synced with <span class="data-mono">{data.githubRepo}</span></p>
	{/if}

	{#if showForm}
		<div class="mb-6 border border-[var(--rule)] p-4">
			<div class="flex flex-col gap-3">
				<Input bind:value={title} placeholder="Milestone title" autofocus />
				<Textarea bind:value={description} placeholder="Description (optional)" rows={2} />
				<label class="flex items-center gap-2 text-[13px] text-[var(--dim)]">
					Due date <input type="date" bind:value={dueDate} class="hairline data-mono px-2 py-1 text-[13px]" />
				</label>
				{#if error}<p class="text-[13px] text-[#f85149]">{error}</p>{/if}
				<div class="flex gap-2">
					<Button variant="accent" onclick={create} disabled={busy}>Create</Button>
					<Button
						variant="ghost"
						onclick={() => {
							showForm = false;
							error = '';
						}}>Cancel</Button
					>
				</div>
			</div>
		</div>
	{/if}

	{#snippet milestoneRow(m: M)}
		{@const total = m.openCount + m.closedCount}
		{@const pct = total ? Math.round((m.closedCount / total) * 100) : 0}
		{@const due = dueMeta(m.dueDate)}
		<div class="border-b border-[var(--rule)] py-4">
			{#if editingId === m.id}
				<div class="flex flex-col gap-2">
					<Input bind:value={editTitle} />
					<Textarea bind:value={editDescription} rows={2} placeholder="Description (optional)" />
					<label class="flex items-center gap-2 text-[13px] text-[var(--dim)]">
						Due date <input type="date" bind:value={editDue} class="hairline data-mono px-2 py-1 text-[13px]" />
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
							<Milestone size={15} class="shrink-0 text-[var(--faint)]" />
							<p class="mono-display truncate text-[15px] text-[var(--text)]">
								{#if firstBoard}
									<a href={`${base}/b/${firstBoard.id}?milestone=${m.id}`} class="mono-focus transition-colors hover:text-[var(--accent)]">{m.title}</a>
								{:else}
									{m.title}
								{/if}
							</p>
							{#if m.githubMilestoneNumber}
								<a
									href={`https://github.com/${data.githubRepo}/milestone/${m.githubMilestoneNumber}`}
									target="_blank"
									rel="noreferrer"
									class="mono-focus shrink-0 text-[var(--faint)] transition-colors hover:text-[var(--accent)]"
									aria-label="View on GitHub"><GitBranch size={13} /></a
								>
							{/if}
						</div>
						{#if m.description}<p class="mt-1 text-[13px] text-[var(--dim)]">{m.description}</p>{/if}
						<div class="mt-2 flex flex-wrap items-center gap-2">
							{#if due}
								<Badge tone={due.overdue ? 'red' : due.soon ? 'amber' : 'neutral'}>{due.overdue ? 'Overdue' : `Due ${due.label}`}</Badge>
							{/if}
							<span class="data-mono text-[var(--faint)]">{m.closedCount} closed · {m.openCount} open</span>
						</div>
						{#if total}
							<div class="mt-2.5 flex max-w-sm items-center gap-3">
								<div class="h-1 min-w-16 flex-1 bg-[var(--rule)]">
									<div class="h-full transition-all duration-500" style={`width:${pct}%;background:var(--accent)`}></div>
								</div>
								<span class="data-mono shrink-0 text-[var(--faint)]">{pct}%</span>
							</div>
						{/if}
					</div>
					{#if data.canManage}
						<div class="flex shrink-0 items-center gap-1">
							<button onclick={() => startEdit(m)} class="hit mono-focus rounded-[3px] p-1.5 text-[var(--faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--text)_8%,transparent)] hover:text-[var(--text)]" aria-label="Edit"><Pencil size={14} /></button>
							{#if m.state === 'open'}
								<button onclick={() => setState(m, 'closed')} class="hit mono-focus rounded-[3px] p-1.5 text-[var(--faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--text)_8%,transparent)] hover:text-[var(--text)]" aria-label="Close milestone"><Check size={14} /></button>
							{:else}
								<button onclick={() => setState(m, 'open')} class="hit mono-focus rounded-[3px] p-1.5 text-[var(--faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--text)_8%,transparent)] hover:text-[var(--text)]" aria-label="Reopen milestone"><RotateCcw size={14} /></button>
							{/if}
							<button onclick={() => requestRemove(m)} class="hit mono-focus rounded-[3px] p-1.5 text-[var(--faint)] transition-colors hover:bg-[color-mix(in_srgb,#f85149_12%,transparent)] hover:text-[#f85149]" aria-label="Delete"><Trash2 size={14} /></button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/snippet}

	{#if data.milestones.length}
		{#if open.length}
			<div class="border-t border-[var(--rule)]">
				{#each open as m (m.id)}{@render milestoneRow(m)}{/each}
			</div>
		{/if}
		{#if closed.length}
			<p class="mt-10 mb-3 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Closed</p>
			<div class="border-t border-[var(--rule)] opacity-70">
				{#each closed as m (m.id)}{@render milestoneRow(m)}{/each}
			</div>
		{/if}
	{:else}
		<EmptyStateApp
			icon={Milestone}
			title="No milestones yet."
			body={data.canManage ? 'Create one to group tickets and sync with GitHub.' : undefined}
		/>
	{/if}
</div>

<Dialog bind:open={confirmOpen} title="Delete milestone?" description={pendingDelete ? `"${pendingDelete.title}" — tickets will be detached, not deleted.` : undefined}>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (confirmOpen = false)}>Cancel</Button>
		<Button variant="danger" onclick={confirmRemove}>Delete</Button>
	{/snippet}
</Dialog>
