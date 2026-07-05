<script lang="ts">
	import { ChevronUp, Link2, Plus, Trash2, X, Check, Search, GitPullRequest, GitMerge, ExternalLink } from '@lucide/svelte';
	import { RELATION_TYPES, type Priority } from '$lib/constants';
	import { PALETTE } from '$lib/colors';
	import { PRIORITY_META } from '$lib/priority';
	import { renderMarkdown } from '$lib/markdown';
	import { clickOutside } from '$lib/utils/clickOutside';
	import Button from '$lib/components/ui/Button.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';

	type Label = { id: string; name: string; color: string };
	type ColumnRef = { id: string; name: string; color: string; category: string };
	type Props = {
		ticketId: string;
		boardId: string;
		projectId: string;
		labels: Label[];
		columns: ColumnRef[];
		currentUser: { id: string; displayName: string; avatarUrl: string | null };
		onclose: () => void;
		onchanged: () => void;
	};
	let { ticketId, projectId, labels, columns, currentUser, onclose, onchanged }: Props = $props();

	let loading = $state(true);
	let detail = $state<any>(null);
	let comments = $state<any[]>([]);
	let access = $state<{ canEdit: boolean; canManage: boolean }>({ canEdit: false, canManage: false });
	let voted = $state(false);
	let members = $state<Array<{ userId: string; displayName: string; avatarUrl: string | null }>>([]);
	let allLabels = $state<Label[]>([]);

	let editingTitle = $state(false);
	let titleDraft = $state('');
	let editingDesc = $state(false);
	let descDraft = $state('');
	let commentDraft = $state('');
	let labelMenu = $state(false);
	let assigneeMenu = $state(false);
	let labelQuery = $state('');
	let newLabelColor = $state<string>(PALETTE[5]);
	let relType = $state<string>('relates');
	let relMenu = $state(false);
	let relQuery = $state('');
	let relResults = $state<Array<{ id: string; number: number; title: string; closedAt: string | null }>>([]);
	let relSearching = $state(false);
	let relTimer: ReturnType<typeof setTimeout> | undefined;

	const filteredLabels = $derived(
		allLabels.filter((l) => l.name.toLowerCase().includes(labelQuery.trim().toLowerCase()))
	);
	const labelExactMatch = $derived(
		allLabels.some((l) => l.name.toLowerCase() === labelQuery.trim().toLowerCase())
	);

	const jsonHeaders = { 'content-type': 'application/json' };
	const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high', 'urgent'];
	const priorityOptions = PRIORITIES.map((p) => ({
		value: p,
		label: PRIORITY_META[p].label,
		color: p === 'none' ? undefined : PRIORITY_META[p].color
	}));
	const relLabel: Record<string, string> = {
		blocks: 'Blocks',
		blocked_by: 'Blocked by',
		relates: 'Relates to',
		duplicates: 'Duplicates',
		parent: 'Parent of',
		child: 'Child of'
	};
	const relOptions = RELATION_TYPES.map((t) => ({ value: t, label: relLabel[t] }));
	const columnOptions = $derived(columns.map((c) => ({ value: c.id, label: c.name, color: c.color })));

	async function load() {
		loading = true;
		detail = null;
		const [tRes, mRes] = await Promise.all([
			fetch(`/api/tickets/${ticketId}`),
			fetch(`/api/projects/${projectId}/members`)
		]);
		if (tRes.ok) {
			const d = await tRes.json();
			detail = d.ticket;
			comments = d.comments;
			access = d.access;
			voted = d.voted;
			titleDraft = d.ticket.title;
			descDraft = d.ticket.description ?? '';
		}
		if (mRes.ok) members = (await mRes.json()).members;
		allLabels = [...labels];
		loading = false;
	}

	// Silent reconcile — never toggles `loading`, so the UI doesn't flash.
	async function refresh() {
		const res = await fetch(`/api/tickets/${ticketId}`);
		if (res.ok) {
			const d = await res.json();
			detail = d.ticket;
			comments = d.comments;
			voted = d.voted;
		}
	}

	$effect(() => {
		if (ticketId) load();
	});

	function apiPatch(body: Record<string, unknown>) {
		return fetch(`/api/tickets/${ticketId}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(body) });
	}

	async function setPriority(v: string) {
		detail.priority = v; // optimistic
		await apiPatch({ priority: v });
		onchanged();
	}
	async function setStatus(columnId: string) {
		detail.columnId = columnId; // optimistic
		await fetch(`/api/tickets/${ticketId}/move`, {
			method: 'POST',
			headers: jsonHeaders,
			body: JSON.stringify({ columnId })
		});
		await refresh(); // pick up closedAt / closed badge
		onchanged();
	}
	async function saveTitle() {
		editingTitle = false;
		const t = titleDraft.trim();
		if (!t || t === detail.title) return;
		detail.title = t;
		await apiPatch({ title: t });
		onchanged();
	}
	async function saveDesc() {
		editingDesc = false;
		if (descDraft === (detail.description ?? '')) return;
		detail.description = descDraft;
		await apiPatch({ description: descDraft });
		onchanged();
	}

	async function toggleVote() {
		voted = !voted;
		detail.votes += voted ? 1 : -1;
		const res = await fetch(`/api/tickets/${ticketId}/vote`, { method: 'POST' });
		if (res.ok) {
			const r = await res.json();
			voted = r.voted;
			detail.votes = r.count;
		}
		onchanged();
	}

	async function addComment() {
		const body = commentDraft.trim();
		if (!body) return;
		commentDraft = '';
		comments = [
			...comments,
			{ id: `tmp-${Date.now()}`, body, authorName: currentUser.displayName, authorAvatar: currentUser.avatarUrl }
		];
		await fetch(`/api/tickets/${ticketId}/comments`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ body }) });
		await refresh();
		onchanged();
	}

	function hasLabel(id: string) {
		return detail?.labels.some((l: Label) => l.id === id);
	}
	async function toggleLabel(id: string) {
		const add = !hasLabel(id);
		const l = allLabels.find((x) => x.id === id);
		if (add && l) detail.labels = [...detail.labels, l];
		else detail.labels = detail.labels.filter((x: Label) => x.id !== id);
		await fetch(`/api/tickets/${ticketId}/labels`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ labelId: id, add }) });
		onchanged();
	}
	async function createLabel() {
		const name = labelQuery.trim();
		if (!name || labelExactMatch) return;
		const res = await fetch(`/api/projects/${projectId}/labels`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ name, color: newLabelColor }) });
		if (res.ok) {
			const l = await res.json();
			allLabels = [...allLabels, { id: l.id, name: l.name, color: l.color }];
			labelQuery = '';
			await toggleLabel(l.id);
		}
	}

	function isAssigned(id: string) {
		return detail?.assignees.some((a: any) => a.userId === id);
	}
	async function toggleAssignee(id: string) {
		const add = !isAssigned(id);
		const m = members.find((x) => x.userId === id);
		if (add && m) detail.assignees = [...detail.assignees, { userId: m.userId, displayName: m.displayName, avatarUrl: m.avatarUrl }];
		else detail.assignees = detail.assignees.filter((a: any) => a.userId !== id);
		await fetch(`/api/tickets/${ticketId}/assignees`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ userId: id, add }) });
		onchanged();
	}

	function searchRelTickets() {
		clearTimeout(relTimer);
		const q = relQuery.trim();
		relTimer = setTimeout(async () => {
			relSearching = true;
			const res = await fetch(
				`/api/projects/${projectId}/tickets/search?exclude=${ticketId}&q=${encodeURIComponent(q)}`
			);
			relResults = res.ok ? (await res.json()).tickets : [];
			relSearching = false;
		}, 180);
	}
	async function pickRelation(targetTicketId: string) {
		relQuery = '';
		relResults = [];
		relMenu = false;
		await fetch(`/api/tickets/${ticketId}/relations`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ targetTicketId, type: relType }) });
		await refresh();
		onchanged();
	}
	async function removeRelation(id: string) {
		detail.relations = detail.relations.filter((r: any) => r.id !== id);
		await fetch(`/api/tickets/${ticketId}/relations`, { method: 'DELETE', headers: jsonHeaders, body: JSON.stringify({ relationId: id }) });
		onchanged();
	}

	async function del() {
		await fetch(`/api/tickets/${ticketId}`, { method: 'DELETE' });
		onchanged();
		onclose();
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-8">
	<button aria-label="Close" class="absolute inset-0 bg-neutral-950/50 backdrop-blur-[2px]" onclick={onclose}></button>
	<div class="relative z-10 my-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
		{#if loading || !detail}
			<div class="grid h-[32rem] place-items-center text-sm text-neutral-400">Loading…</div>
		{:else}
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-neutral-100 px-6 py-3 dark:border-neutral-800">
				<div class="flex items-center gap-2 text-sm text-neutral-500">
					<span class="font-mono font-medium">#{detail.number}</span>
					{#if detail.githubIssueNumber}
						{#if detail.githubRepo}
							<a href={`https://github.com/${detail.githubRepo}/issues/${detail.githubIssueNumber}`} target="_blank" rel="noreferrer" class="flex items-center gap-1 hover:text-neutral-800 hover:underline dark:hover:text-neutral-200"><Link2 size={13} /> {detail.githubIssueNumber}</a>
						{:else}
							<span class="flex items-center gap-1"><Link2 size={13} /> {detail.githubIssueNumber}</span>
						{/if}
					{/if}
					{#if detail.githubPrNumber}
						{@const prCls = detail.githubPrState === 'merged' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' : detail.githubPrState === 'closed' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'}
						{@const PrIcon = detail.githubPrState === 'merged' ? GitMerge : GitPullRequest}
						<a
							href={detail.githubRepo ? `https://github.com/${detail.githubRepo}/pull/${detail.githubPrNumber}` : '#'}
							target="_blank"
							rel="noreferrer"
							class={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${prCls}`}
							title={`Pull request #${detail.githubPrNumber}${detail.githubPrState ? ' — ' + detail.githubPrState : ''}`}
						>
							<PrIcon size={11} /> PR #{detail.githubPrNumber}
						</a>
					{/if}
					{#if detail.closedAt}<span class="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">Closed</span>{/if}
				</div>
				<button onclick={onclose} class="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Close"><X size={17} /></button>
			</div>

			<div class="grid min-h-[34rem] sm:grid-cols-[1fr_19rem]">
				<!-- Main -->
				<div class="flex min-w-0 flex-col gap-6 p-6">
					<!-- Title -->
					{#if editingTitle && access.canEdit}
						<!-- svelte-ignore a11y_autofocus -->
						<input bind:value={titleDraft} onblur={saveTitle} onkeydown={(e) => e.key === 'Enter' && saveTitle()} autofocus class="w-full rounded-md border border-neutral-300 px-2 py-1 text-xl font-semibold dark:border-neutral-700 dark:bg-neutral-900" />
					{:else}
						<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
						<h1 class="text-xl leading-tight font-semibold {access.canEdit ? 'cursor-text hover:opacity-80' : ''}" onclick={() => access.canEdit && (editingTitle = true)}>{detail.title}</h1>
					{/if}

					<!-- Description -->
					<section>
						<h3 class="mb-2 text-xs font-semibold tracking-wide text-neutral-400 uppercase">Description</h3>
						{#if editingDesc && access.canEdit}
							<Textarea bind:value={descDraft} rows={6} placeholder="Add a description… (markdown supported)" />
							<div class="mt-2 flex gap-2">
								<Button size="sm" variant="primary" onclick={saveDesc}>Save</Button>
								<Button size="sm" variant="ghost" onclick={() => { editingDesc = false; descDraft = detail.description ?? ''; }}>Cancel</Button>
							</div>
						{:else if detail.description}
							<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
							<div class="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-neutral-100 bg-neutral-50/60 p-3 dark:border-neutral-800 dark:bg-neutral-800/30 {access.canEdit ? 'cursor-text' : ''}" onclick={() => access.canEdit && (editingDesc = true)}>
								{@html renderMarkdown(detail.description)}
							</div>
						{:else if access.canEdit}
							<button class="w-full rounded-lg border border-dashed border-neutral-200 p-3 text-left text-sm text-neutral-400 hover:border-neutral-300 dark:border-neutral-800" onclick={() => (editingDesc = true)}>Add a description…</button>
						{:else}
							<p class="text-sm text-neutral-400">No description.</p>
						{/if}
					</section>

					<!-- Activity / comments -->
					<section class="border-t border-neutral-100 pt-5 dark:border-neutral-800">
						<div class="mb-3 flex items-center justify-between">
							<h3 class="text-xs font-semibold tracking-wide text-neutral-400 uppercase">Activity</h3>
							<button
								onclick={toggleVote}
								class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition {voted ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'}"
							>
								<ChevronUp size={14} /> {detail.votes} {detail.votes === 1 ? 'upvote' : 'upvotes'}
							</button>
						</div>

						<div class="space-y-3">
							{#each comments as c (c.id)}
								<div class="flex gap-2.5">
									<div class="grid size-7 shrink-0 place-items-center rounded-full bg-neutral-200 text-[11px] font-semibold dark:bg-neutral-700">{(c.authorName ?? '?').slice(0, 1).toUpperCase()}</div>
									<div class="min-w-0 flex-1 rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800/40">
										<p class="mb-0.5 text-xs font-medium text-neutral-600 dark:text-neutral-300">{c.authorName ?? 'Unknown'}</p>
										<div class="prose prose-sm dark:prose-invert max-w-none">{@html renderMarkdown(c.body)}</div>
									</div>
								</div>
							{:else}
								<p class="text-sm text-neutral-400">No comments yet.</p>
							{/each}
						</div>

						<div class="mt-3">
							<Textarea bind:value={commentDraft} rows={2} placeholder="Write a comment…" />
							<div class="mt-2"><Button size="sm" variant="primary" onclick={addComment} disabled={!commentDraft.trim()}>Comment</Button></div>
						</div>
					</section>
				</div>

				<!-- Sidebar / properties -->
				<div class="space-y-5 border-t border-neutral-100 bg-neutral-50/50 p-5 text-sm sm:border-t-0 sm:border-l dark:border-neutral-800 dark:bg-neutral-900/50">
					<div>
						<p class="mb-1.5 text-xs font-medium text-neutral-400">Status</p>
						{#if access.canEdit}
							<Select value={detail.columnId} options={columnOptions} onchange={setStatus} />
						{:else}
							<span>{columns.find((c) => c.id === detail.columnId)?.name ?? '—'}</span>
						{/if}
					</div>

					<div>
						<p class="mb-1.5 text-xs font-medium text-neutral-400">Priority</p>
						{#if access.canEdit}
							<Select value={detail.priority} options={priorityOptions} onchange={setPriority} />
						{:else}
							<span>{PRIORITY_META[detail.priority as Priority].label}</span>
						{/if}
					</div>

					<div class="relative">
						<p class="mb-1.5 text-xs font-medium text-neutral-400">Assignees</p>
						<div class="flex flex-wrap items-center gap-1">
							{#each detail.assignees as a (a.userId)}
								<span class="flex items-center gap-1 rounded-full bg-white py-0.5 pr-2 pl-0.5 text-xs shadow-sm dark:bg-neutral-800">
									<span class="grid size-4 place-items-center rounded-full bg-neutral-300 text-[8px] dark:bg-neutral-600">{a.displayName.slice(0, 1)}</span>
									{a.displayName}
								</span>
							{/each}
							{#if access.canEdit}
								<button onclick={() => (assigneeMenu = !assigneeMenu)} class="rounded-full border border-dashed border-neutral-300 p-1 text-neutral-400 hover:border-neutral-400 dark:border-neutral-700" aria-label="Edit assignees"><Plus size={12} /></button>
							{/if}
						</div>
						{#if assigneeMenu}
							<div use:clickOutside={() => (assigneeMenu = false)} class="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
								{#each members as m (m.userId)}
									<button onclick={() => toggleAssignee(m.userId)} class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800">
										<span class="flex-1 truncate">{m.displayName}</span>
										{#if isAssigned(m.userId)}<span class="text-brand-600">✓</span>{/if}
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<div class="relative">
						<p class="mb-1.5 text-xs font-medium text-neutral-400">Labels</p>
						<div class="flex flex-wrap items-center gap-1">
							{#each detail.labels as l (l.id)}
								<span class="rounded px-1.5 py-0.5 text-[10px] font-medium" style={`background:${l.color}22;color:${l.color}`}>{l.name}</span>
							{/each}
							{#if access.canEdit}
								<button onclick={() => { labelMenu = !labelMenu; labelQuery = ''; }} class="rounded border border-dashed border-neutral-300 p-0.5 text-neutral-400 hover:border-neutral-400 dark:border-neutral-700" aria-label="Edit labels"><Plus size={12} /></button>
							{/if}
						</div>
						{#if labelMenu}
							<div use:clickOutside={() => (labelMenu = false)} class="absolute z-20 mt-1 w-64 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
								<!-- svelte-ignore a11y_autofocus -->
								<input bind:value={labelQuery} autofocus placeholder="Search or create a label…" onkeydown={(e) => e.key === 'Enter' && createLabel()} class="mb-2 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:outline-none dark:border-neutral-700 dark:bg-neutral-900" />
								<div class="max-h-40 overflow-y-auto">
									{#each filteredLabels as l (l.id)}
										<button onclick={() => toggleLabel(l.id)} class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800">
											<span class="size-3 shrink-0 rounded-full" style={`background:${l.color}`}></span>
											<span class="min-w-0 flex-1 truncate">{l.name}</span>
											{#if hasLabel(l.id)}<Check size={13} class="shrink-0 text-brand-600" />{/if}
										</button>
									{:else}
										{#if !labelQuery.trim()}<p class="px-2 py-2 text-xs text-neutral-400">No labels yet — type to create one.</p>{/if}
									{/each}
								</div>
								<!-- Create when the typed name doesn't already exist -->
								{#if labelQuery.trim() && !labelExactMatch}
									<div class="mt-1.5 border-t border-neutral-100 pt-2 dark:border-neutral-800">
										<div class="mb-2 flex flex-wrap items-center gap-1.5">
											{#each PALETTE as c (c)}
												<button onclick={() => (newLabelColor = c)} class="size-5 rounded-full ring-offset-1 ring-offset-white transition dark:ring-offset-neutral-900" class:ring-2={newLabelColor === c} style={`background:${c};--tw-ring-color:${c}`} aria-label={`Use ${c}`}></button>
											{/each}
										</div>
										<button onclick={createLabel} class="flex w-full items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-1.5 text-xs font-medium hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700">
											<Plus size={12} /> Create
											<span class="ml-0.5 max-w-[9rem] truncate rounded px-1.5 py-0.5 text-[10px] font-medium" style={`background:${newLabelColor}22;color:${newLabelColor}`}>{labelQuery.trim()}</span>
										</button>
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<div>
						<p class="mb-1.5 text-xs font-medium text-neutral-400">Relations</p>
						<div class="space-y-1">
							{#each detail.relations as r (r.id)}
								<div class="flex items-center gap-1.5 text-xs">
									<span class="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">{r.label}</span>
									<span class="shrink-0 font-mono text-neutral-400">#{r.targetNumber}</span>
									<span class="min-w-0 flex-1 truncate">{r.targetTitle}</span>
									{#if access.canEdit}<button onclick={() => removeRelation(r.id)} class="shrink-0 text-neutral-400 hover:text-red-600" aria-label="Remove"><X size={12} /></button>{/if}
								</div>
							{:else}
								<p class="text-xs text-neutral-400">No linked tickets.</p>
							{/each}
						</div>
						{#if access.canEdit}
							<div class="relative mt-2">
								<Select bind:value={relType} options={relOptions} size="sm" class="mb-1.5 w-full" />
								<div class="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30 dark:border-neutral-800 dark:bg-neutral-900">
									<Search size={13} class="shrink-0 text-neutral-400" />
									<input
										bind:value={relQuery}
										oninput={() => { relMenu = true; searchRelTickets(); }}
										onfocus={() => { relMenu = true; searchRelTickets(); }}
										placeholder="Link a ticket by name or #…"
										class="w-full bg-transparent py-1.5 text-xs focus:outline-none"
									/>
								</div>
								{#if relMenu}
									<div use:clickOutside={() => (relMenu = false)} class="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
										{#if relSearching}
											<p class="px-2 py-2 text-xs text-neutral-400">Searching…</p>
										{/if}
										{#each relResults as t (t.id)}
											<button onclick={() => pickRelation(t.id)} class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800">
												<span class="shrink-0 font-mono text-neutral-400">#{t.number}</span>
												<span class="min-w-0 flex-1 truncate">{t.title}</span>
												{#if t.closedAt}<span class="shrink-0 text-[10px] text-neutral-400">closed</span>{/if}
											</button>
										{/each}
										{#if !relSearching && !relResults.length}
											<p class="px-2 py-2 text-xs text-neutral-400">No matching tickets.</p>
										{/if}
									</div>
								{/if}
							</div>
						{/if}
					</div>

					{#if detail.githubRepo && detail.githubIssueNumber}
						<div>
							<p class="mb-1.5 text-xs font-medium text-neutral-400">GitHub</p>
							<a
								href={`https://github.com/${detail.githubRepo}/issues/${detail.githubIssueNumber}`}
								target="_blank"
								rel="noreferrer"
								class="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
							>
								<Link2 size={14} class="text-neutral-400" /> Issue #{detail.githubIssueNumber}
								<ExternalLink size={12} class="ml-auto text-neutral-400" />
							</a>
							{#if detail.githubPrNumber}
								<a
									href={`https://github.com/${detail.githubRepo}/pull/${detail.githubPrNumber}`}
									target="_blank"
									rel="noreferrer"
									class="mt-1.5 flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
								>
									{#if detail.githubPrState === 'merged'}<GitMerge size={14} class="text-violet-500" />{:else}<GitPullRequest size={14} class={detail.githubPrState === 'closed' ? 'text-red-400' : 'text-green-500'} />{/if}
									PR #{detail.githubPrNumber}
									{#if detail.githubPrState}<span class="text-xs text-neutral-400">{detail.githubPrState}</span>{/if}
									<ExternalLink size={12} class="ml-auto text-neutral-400" />
								</a>
							{/if}
						</div>
					{/if}

					<div class="border-t border-neutral-100 pt-3 text-xs text-neutral-400 dark:border-neutral-800">
						{#if detail.authorName}Opened by {detail.authorName}{/if}
						{#if access.canManage}
							<button onclick={del} class="mt-2 flex items-center gap-1.5 text-red-600 hover:underline"><Trash2 size={13} /> Delete ticket</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
