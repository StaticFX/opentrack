<script lang="ts">
	import { ChevronUp, Link2, Plus, Trash2, X, Check, Search, GitPullRequest, GitMerge, GitBranch, ExternalLink, Unlink, Bell, BellOff, Paperclip, Archive } from '@lucide/svelte';
	import { ciMeta } from '$lib/github-ci';
	import { RELATION_TYPES, type Priority } from '$lib/constants';
	import { PALETTE } from '$lib/colors';
	import { PRIORITY_META } from '$lib/priority';
	import { renderMarkdown } from '$lib/markdown';
	import { clickOutside } from '$lib/utils/clickOutside';
	import Button from '$lib/components/ui/Button.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import ReactionBar from '$lib/components/ReactionBar.svelte';

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
	let watching = $state(false);
	let reactions = $state<any[]>([]);
	let checklist = $state<Array<{ id: string; text: string; done: boolean }>>([]);
	let checklistDraft = $state('');
	let fields = $state<Array<{ id: string; name: string; type: string; options: string[] | null; value: string | null }>>([]);
	let attachments = $state<Array<{ id: string; filename: string; mime: string; size: number; url: string }>>([]);
	let uploading = $state(false);
	const checklistDone = $derived(checklist.filter((i) => i.done).length);
	let members = $state<Array<{ userId: string; displayName: string; avatarUrl: string | null }>>([]);
	let allLabels = $state<Label[]>([]);
	let milestones = $state<Array<{ id: string; title: string; state: string }>>([]);

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
	let prMenu = $state(false);
	let prQuery = $state('');
	let prResults = $state<Array<{ number: number; title: string; draft: boolean; headRef: string; state: string; url: string }>>([]);
	let prSearching = $state(false);
	let prTimer: ReturnType<typeof setTimeout> | undefined;
	let prLinking = $state(false);

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
		const [tRes, mRes, msRes] = await Promise.all([
			fetch(`/api/tickets/${ticketId}`),
			fetch(`/api/projects/${projectId}/members`),
			fetch(`/api/projects/${projectId}/milestones`)
		]);
		if (msRes.ok) milestones = (await msRes.json()).milestones ?? [];
		if (tRes.ok) {
			const d = await tRes.json();
			detail = d.ticket;
			comments = d.comments;
			access = d.access;
			voted = d.voted;
			watching = d.watching;
			reactions = d.reactions ?? [];
			checklist = d.checklist ?? [];
			fields = d.fields ?? [];
		attachments = d.attachments ?? [];
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
			reactions = d.reactions ?? [];
			checklist = d.checklist ?? [];
			fields = d.fields ?? [];
		attachments = d.attachments ?? [];
		}
	}

	async function addChecklistItem() {
		const text = checklistDraft.trim();
		if (!text) return;
		checklistDraft = '';
		const res = await fetch(`/api/tickets/${ticketId}/checklist`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ text }) });
		if (res.ok) checklist = [...checklist, (await res.json()).item];
	}
	async function toggleChecklistItem(item: { id: string; done: boolean }) {
		const done = !item.done;
		checklist = checklist.map((i) => (i.id === item.id ? { ...i, done } : i));
		await fetch(`/api/checklist/${item.id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ done }) });
	}
	async function removeChecklistItem(id: string) {
		checklist = checklist.filter((i) => i.id !== id);
		await fetch(`/api/checklist/${id}`, { method: 'DELETE' });
	}

	async function setField(fieldId: string, value: string) {
		const res = await fetch(`/api/tickets/${ticketId}/fields`, {
			method: 'POST',
			headers: jsonHeaders,
			body: JSON.stringify({ fieldId, value })
		});
		if (res.ok) fields = (await res.json()).fields;
	}

	async function toggleWatch() {
		watching = !watching; // optimistic
		const res = await fetch('/api/watch', {
			method: 'POST',
			headers: jsonHeaders,
			body: JSON.stringify({ subjectType: 'ticket', subjectId: ticketId, watch: watching })
		});
		if (res.ok) watching = (await res.json()).watching;
		else watching = !watching; // revert
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
	async function setMilestone(v: string) {
		const milestoneId = v || null;
		const m = milestones.find((x) => x.id === milestoneId);
		detail.milestoneId = milestoneId; // optimistic
		detail.milestone = m ? { id: m.id, title: m.title, state: m.state } : null;
		await fetch(`/api/tickets/${ticketId}/milestone`, {
			method: 'POST',
			headers: jsonHeaders,
			body: JSON.stringify({ milestoneId })
		});
		onchanged();
	}
	const milestoneOptions = $derived([
		{ value: '', label: 'No milestone' },
		...milestones.map((m) => ({ value: m.id, label: m.state === 'closed' ? `${m.title} (closed)` : m.title }))
	]);
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

	// ── Attachments ──────────────────────────────────────────────────────
	function mdRef(a: { filename: string; mime: string; url: string }): string {
		return a.mime.startsWith('image/') ? `![${a.filename}](${a.url})` : `[${a.filename}](${a.url})`;
	}
	async function uploadOne(file: File) {
		const fd = new FormData();
		fd.append('file', file);
		const res = await fetch(`/api/tickets/${ticketId}/attachments`, { method: 'POST', body: fd });
		if (!res.ok) return null;
		return (await res.json()) as { id: string; filename: string; mime: string; url: string };
	}
	/** Upload files; optionally append their markdown into a draft ('desc'|'comment'). */
	async function uploadFiles(files: File[], into: 'desc' | 'comment' | null = null) {
		if (!files.length || !access.canEdit) return;
		uploading = true;
		for (const f of files) {
			const a = await uploadOne(f);
			if (!a) continue;
			if (into === 'desc') {
				descDraft = descDraft ? `${descDraft}\n\n${mdRef(a)}` : mdRef(a);
				editingDesc = true;
			} else if (into === 'comment') {
				commentDraft = commentDraft ? `${commentDraft}\n${mdRef(a)}` : mdRef(a);
			}
		}
		uploading = false;
		await refresh();
		onchanged();
	}
	function filesFrom(e: ClipboardEvent | DragEvent): File[] {
		const dt = (e as ClipboardEvent).clipboardData ?? (e as DragEvent).dataTransfer;
		return dt ? Array.from(dt.files) : [];
	}
	function onPaste(e: ClipboardEvent, into: 'desc' | 'comment') {
		const files = filesFrom(e);
		if (files.length) {
			e.preventDefault();
			void uploadFiles(files, into);
		}
	}
	function onDropZone(e: DragEvent) {
		e.preventDefault();
		const files = filesFrom(e);
		if (files.length) void uploadFiles(files, null);
	}
	async function removeAttachment(id: string) {
		attachments = attachments.filter((a) => a.id !== id);
		await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
		onchanged();
	}
	function fmtSize(n: number): string {
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
		return `${(n / (1024 * 1024)).toFixed(1)} MB`;
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

	function searchPRs() {
		clearTimeout(prTimer);
		const q = prQuery.trim();
		prTimer = setTimeout(async () => {
			prSearching = true;
			const res = await fetch(`/api/tickets/${ticketId}/github/pulls?q=${encodeURIComponent(q)}`);
			prResults = res.ok ? (await res.json()).pulls : [];
			prSearching = false;
		}, 200);
	}
	async function linkPR(number: number) {
		prMenu = false;
		prQuery = '';
		prResults = [];
		prLinking = true;
		await fetch(`/api/tickets/${ticketId}/github/link`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ number }) });
		await refresh();
		prLinking = false;
		onchanged();
	}
	async function unlinkPR() {
		await fetch(`/api/tickets/${ticketId}/github/link`, { method: 'DELETE' });
		await refresh();
		onchanged();
	}

	async function toggleArchive() {
		const archived = !detail.archived;
		detail.archived = archived;
		await fetch(`/api/tickets/${ticketId}/archive`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ archived }) });
		onchanged();
		if (archived) onclose();
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
							{#if ciMeta(detail.githubCiStatus)}
								{@const ci = ciMeta(detail.githubCiStatus)}
								<span class={`ml-0.5 inline-block h-2 w-2 rounded-full ${ci?.dotClass}`} title={ci?.label}></span>
							{/if}
						</a>
					{/if}
					{#if detail.closedAt}<span class="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">Closed</span>{/if}
				</div>
				<div class="flex items-center gap-1">
					<button
						onclick={toggleWatch}
						class={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${watching ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
						title={watching ? 'Stop watching this ticket' : 'Watch for updates'}
					>
						{#if watching}<Bell size={13} /> Watching{:else}<BellOff size={13} /> Watch{/if}
					</button>
					<button onclick={onclose} class="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Close"><X size={17} /></button>
				</div>
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
							<Textarea bind:value={descDraft} rows={6} placeholder="Add a description… (markdown supported · paste or drop files)" onpaste={(e: ClipboardEvent) => onPaste(e, 'desc')} ondrop={(e: DragEvent) => { const f = filesFrom(e); if (f.length) { e.preventDefault(); void uploadFiles(f, 'desc'); } }} />
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
						<div class="mt-3">
							<ReactionBar subjectType="ticket" subjectId={ticketId} {reactions} />
						</div>
					</section>

					<!-- Attachments -->
					{#if attachments.length || access.canEdit}
						<section class="border-t border-neutral-100 pt-5 dark:border-neutral-800">
							<div class="mb-2 flex items-center justify-between">
								<h3 class="text-xs font-semibold tracking-wide text-neutral-400 uppercase">Attachments</h3>
								{#if access.canEdit}
									<label class="cursor-pointer text-xs text-brand-600 hover:underline dark:text-brand-400">
										{uploading ? 'Uploading…' : 'Add files'}
										<input type="file" multiple class="hidden" onchange={(e) => { const inp = e.currentTarget; void uploadFiles(Array.from(inp.files ?? []), null).then(() => (inp.value = '')); }} />
									</label>
								{/if}
							</div>
							{#if attachments.length}
								<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
									{#each attachments as a (a.id)}
										<div class="group relative overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
											<a href={a.url} target="_blank" rel="noreferrer" class="block">
												{#if a.mime.startsWith('image/')}
													<img src={a.url} alt={a.filename} class="h-24 w-full object-cover" />
												{:else}
													<div class="flex h-24 items-center gap-2 p-2">
														<Paperclip size={16} class="shrink-0 text-neutral-400" />
														<span class="min-w-0 break-words text-xs text-neutral-600 dark:text-neutral-300">{a.filename}</span>
													</div>
												{/if}
											</a>
											<div class="flex items-center justify-between px-2 py-1 text-[10px] text-neutral-400">
												<span class="min-w-0 truncate">{a.filename}</span>
												<span class="shrink-0">{fmtSize(a.size)}</span>
											</div>
											{#if access.canEdit}
												<button onclick={() => removeAttachment(a.id)} class="absolute top-1 right-1 hidden rounded bg-neutral-900/60 p-1 text-white group-hover:block" aria-label="Delete attachment"><Trash2 size={12} /></button>
											{/if}
										</div>
									{/each}
								</div>
							{:else if access.canEdit}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									ondrop={onDropZone}
									ondragover={(e) => e.preventDefault()}
									class="rounded-lg border border-dashed border-neutral-200 p-4 text-center text-xs text-neutral-400 dark:border-neutral-800"
								>
									Drop files here, paste into the description, or use “Add files”.
								</div>
							{/if}
						</section>
					{/if}

					<!-- Checklist -->
					<section class="border-t border-neutral-100 pt-5 dark:border-neutral-800">
						<div class="mb-2 flex items-center justify-between">
							<h3 class="text-xs font-semibold tracking-wide text-neutral-400 uppercase">Checklist</h3>
							{#if checklist.length}<span class="text-xs text-neutral-400">{checklistDone}/{checklist.length}</span>{/if}
						</div>
						{#if checklist.length}
							<div class="mb-2 h-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
								<div class="h-full rounded-full bg-brand-500 transition-all" style={`width:${Math.round((checklistDone / checklist.length) * 100)}%`}></div>
							</div>
						{/if}
						<div class="space-y-0.5">
							{#each checklist as item (item.id)}
								<div class="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
									<button
										onclick={() => toggleChecklistItem(item)}
										disabled={!access.canEdit}
										class={`grid size-4 shrink-0 place-items-center rounded border ${item.done ? 'border-brand-500 bg-brand-500 text-white' : 'border-neutral-300 dark:border-neutral-600'}`}
										aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
									>
										{#if item.done}<Check size={11} />{/if}
									</button>
									<span class={`min-w-0 flex-1 text-sm ${item.done ? 'text-neutral-400 line-through' : ''}`}>{item.text}</span>
									{#if access.canEdit}
										<button onclick={() => removeChecklistItem(item.id)} class="shrink-0 text-neutral-300 opacity-0 group-hover:opacity-100 hover:text-red-600" aria-label="Remove"><X size={13} /></button>
									{/if}
								</div>
							{/each}
						</div>
						{#if access.canEdit}
							<div class="mt-1.5 flex items-center gap-2">
								<input
									bind:value={checklistDraft}
									onkeydown={(e) => e.key === 'Enter' && addChecklistItem()}
									placeholder="Add an item…"
									class="h-8 w-full rounded-md border border-neutral-200 px-2 text-sm focus-visible:border-brand-500 focus-visible:outline-none dark:border-neutral-800 dark:bg-neutral-900"
								/>
								<Button size="sm" variant="ghost" onclick={addChecklistItem} disabled={!checklistDraft.trim()}><Plus size={14} /></Button>
							</div>
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
										<div class="mt-1.5"><ReactionBar subjectType="comment" subjectId={c.id} reactions={c.reactions ?? []} size="sm" /></div>
									</div>
								</div>
							{:else}
								<p class="text-sm text-neutral-400">No comments yet.</p>
							{/each}
						</div>

						<div class="mt-3">
							<Textarea bind:value={commentDraft} rows={2} placeholder="Write a comment… (paste or drop files)" onpaste={(e: ClipboardEvent) => onPaste(e, 'comment')} />
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

					{#if milestones.length || detail.milestone}
						<div>
							<p class="mb-1.5 text-xs font-medium text-neutral-400">Milestone</p>
							{#if access.canEdit}
								<Select value={detail.milestoneId ?? ''} options={milestoneOptions} onchange={setMilestone} />
							{:else}
								<span>{detail.milestone?.title ?? '—'}</span>
							{/if}
						</div>
					{/if}

					<div class="relative">
						<p class="mb-1.5 text-xs font-medium text-neutral-400">Assignees</p>
						<div class="flex flex-wrap items-center gap-1">
							{#each detail.assignees as a (a.userId ?? a.githubLogin)}
								<span class="flex items-center gap-1 rounded-full bg-white py-0.5 pr-2 pl-0.5 text-xs shadow-sm dark:bg-neutral-800" title={a.githubLogin ? `@${a.githubLogin}` : a.displayName}>
									{#if a.avatarUrl}
										<img src={a.avatarUrl} alt={a.displayName} class="size-4 rounded-full" />
									{:else}
										<span class="grid size-4 place-items-center rounded-full bg-neutral-300 text-[8px] dark:bg-neutral-600">{a.displayName.slice(0, 1)}</span>
									{/if}
									{a.displayName}
									{#if a.githubLogin}<span class="text-neutral-400">@{a.githubLogin}</span>{/if}
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

					{#if fields.length}
						{@const fieldCls = 'h-8 w-full rounded-md border border-neutral-200 px-2 text-sm focus-visible:border-brand-500 focus-visible:outline-none dark:border-neutral-800 dark:bg-neutral-900'}
						<div>
							<p class="mb-1.5 text-xs font-medium text-neutral-400">Fields</p>
							<div class="space-y-2">
								{#each fields as f (f.id)}
									<div>
										<span class="mb-0.5 block text-[11px] text-neutral-500">{f.name}</span>
										{#if !access.canEdit}
											<p class="text-sm">{f.type === 'checkbox' ? (f.value === 'true' ? 'Yes' : 'No') : (f.value || '—')}</p>
										{:else if f.type === 'select'}
											<select value={f.value ?? ''} onchange={(e) => setField(f.id, e.currentTarget.value)} class={fieldCls}>
												<option value="">—</option>
												{#each f.options ?? [] as o (o)}<option value={o}>{o}</option>{/each}
											</select>
										{:else if f.type === 'checkbox'}
											<input type="checkbox" checked={f.value === 'true'} onchange={(e) => setField(f.id, e.currentTarget.checked ? 'true' : 'false')} class="size-4 rounded accent-brand-600" />
										{:else if f.type === 'date'}
											<input type="date" value={f.value ?? ''} onchange={(e) => setField(f.id, e.currentTarget.value)} class={fieldCls} />
										{:else if f.type === 'number'}
											<input type="number" value={f.value ?? ''} onchange={(e) => setField(f.id, e.currentTarget.value)} class={fieldCls} />
										{:else}
											<input type="text" value={f.value ?? ''} onchange={(e) => setField(f.id, e.currentTarget.value)} class={fieldCls} />
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}

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

					{#if detail.githubRepo}
						<div>
							<p class="mb-1.5 text-xs font-medium text-neutral-400">GitHub</p>
							{#if detail.githubIssueNumber}
								<a
									href={`https://github.com/${detail.githubRepo}/issues/${detail.githubIssueNumber}`}
									target="_blank"
									rel="noreferrer"
									class="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
								>
									<Link2 size={14} class="text-neutral-400" /> Issue #{detail.githubIssueNumber}
									<ExternalLink size={12} class="ml-auto text-neutral-400" />
								</a>
							{/if}
							{#if detail.githubPrNumber}
								{@const ci = ciMeta(detail.githubCiStatus)}
								<div class="mt-1.5 rounded-md border border-neutral-200 dark:border-neutral-800">
									<a
										href={`https://github.com/${detail.githubRepo}/pull/${detail.githubPrNumber}`}
										target="_blank"
										rel="noreferrer"
										class="flex items-center gap-1.5 px-2.5 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
									>
										{#if detail.githubPrState === 'merged'}<GitMerge size={14} class="text-violet-500" />{:else}<GitPullRequest size={14} class={detail.githubPrState === 'closed' ? 'text-red-400' : 'text-green-500'} />{/if}
										PR #{detail.githubPrNumber}
										{#if detail.githubPrState}<span class="text-xs text-neutral-400">{detail.githubPrState}</span>{/if}
										<ExternalLink size={12} class="ml-auto text-neutral-400" />
									</a>
									{#if detail.githubPrHeadRef || ci}
										<div class="flex items-center gap-2 border-t border-neutral-100 px-2.5 py-1.5 dark:border-neutral-800/70">
											{#if detail.githubPrHeadRef}
												<span class="flex min-w-0 items-center gap-1 text-xs text-neutral-500" title={detail.githubPrHeadRef}>
													<GitBranch size={12} class="shrink-0 text-neutral-400" />
													<span class="truncate font-mono">{detail.githubPrHeadRef}</span>
												</span>
											{/if}
											{#if ci}
												<span class={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${ci.pillClass}`}>{ci.label}</span>
											{/if}
										</div>
									{/if}
									{#if access.canEdit && detail.githubPrLinkSource === 'manual'}
										<button
											onclick={unlinkPR}
											class="flex w-full items-center gap-1.5 border-t border-neutral-100 px-2.5 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50 hover:text-red-600 dark:border-neutral-800/70 dark:hover:bg-neutral-800"
										>
											<Unlink size={12} /> Unlink PR
										</button>
									{/if}
								</div>
							{:else if access.canEdit}
								<div class="relative mt-1.5" use:clickOutside={() => (prMenu = false)}>
									<button
										onclick={() => { prMenu = !prMenu; if (prMenu && prResults.length === 0) searchPRs(); }}
										class="flex w-full items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
										disabled={prLinking}
									>
										<GitPullRequest size={14} class="text-neutral-400" /> {prLinking ? 'Linking…' : 'Link a pull request'}
									</button>
									{#if prMenu}
										<div class="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
											<div class="flex items-center gap-1.5 border-b border-neutral-100 px-1.5 pb-1.5 dark:border-neutral-800">
												<Search size={13} class="text-neutral-400" />
												<input
													bind:value={prQuery}
													oninput={searchPRs}
													placeholder="Search open PRs…"
													class="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
												/>
											</div>
											<div class="max-h-52 overflow-y-auto pt-1">
												{#if prSearching}
													<p class="px-2 py-1.5 text-xs text-neutral-400">Searching…</p>
												{:else if prResults.length === 0}
													<p class="px-2 py-1.5 text-xs text-neutral-400">No open pull requests found.</p>
												{:else}
													{#each prResults as pr (pr.number)}
														<button
															onclick={() => linkPR(pr.number)}
															class="flex w-full items-start gap-1.5 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
														>
															<GitPullRequest size={13} class="mt-0.5 shrink-0 text-green-500" />
															<span class="min-w-0">
																<span class="block truncate">{pr.title}</span>
																<span class="block truncate text-xs text-neutral-400">#{pr.number}{pr.headRef ? ' · ' + pr.headRef : ''}{pr.draft ? ' · draft' : ''}</span>
															</span>
														</button>
													{/each}
												{/if}
											</div>
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/if}

					<div class="border-t border-neutral-100 pt-3 text-xs text-neutral-400 dark:border-neutral-800">
						{#if detail.authorName}Opened by {detail.authorName}{/if}
						{#if access.canEdit && (detail.closedAt || detail.archived)}
							<button onclick={toggleArchive} class="mt-2 flex items-center gap-1.5 text-neutral-500 hover:text-neutral-800 hover:underline dark:hover:text-neutral-200">
								<Archive size={13} /> {detail.archived ? 'Restore from archive' : 'Archive ticket'}
							</button>
						{/if}
						{#if access.canManage}
							<button onclick={del} class="mt-2 flex items-center gap-1.5 text-red-600 hover:underline"><Trash2 size={13} /> Delete ticket</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
