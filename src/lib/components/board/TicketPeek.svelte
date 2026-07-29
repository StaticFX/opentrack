<script lang="ts">
	import { ChevronUp, Link2, Link, Plus, Trash2, X, Check, Search, GitPullRequest, GitMerge, GitBranch, ExternalLink, Unlink, Bell, Paperclip, Archive, Pencil, Maximize2, Minimize2, MoreHorizontal, ChevronRight } from '@lucide/svelte';
	import { fade, fly } from 'svelte/transition';
	import { expoOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { MediaQuery } from 'svelte/reactivity';
	import { page } from '$app/state';
	import { ciMeta } from '$lib/github-ci';
	import { RELATION_TYPES, type Priority } from '$lib/constants';
	import { PALETTE } from '$lib/colors';
	import { PRIORITY_META } from '$lib/priority';
	import { renderMarkdown } from '$lib/markdown';
	import { clickOutside } from '$lib/utils/clickOutside';
	import { cn } from '$lib/utils/cn';
	import { toast } from '$lib/toast';
	import Button from '$lib/components/ui/Button.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Popover from '$lib/components/ui/Popover.svelte';
	import DropdownMenu from '$lib/components/ui/DropdownMenu.svelte';
	import type { MenuItem } from '$lib/components/ui/DropdownMenu.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Kbd from '$lib/components/ui/Kbd.svelte';
	import Tooltip from '$lib/components/ui/Tooltip.svelte';
	import TimeAgo from '$lib/components/ui/TimeAgo.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import AvatarStack from '$lib/components/ui/AvatarStack.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import ClickSpark from '$lib/components/vendor/ClickSpark.svelte';
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
		/** '&full=1' variant — the board owns the URL/history for it. */
		presentation?: 'peek' | 'full';
		/** ⤢/collapse pressed — the board pushes or pops `&full=1`. */
		ontogglefull?: () => void;
	};
	let { ticketId, projectId, labels, columns, currentUser, onclose, onchanged, presentation = 'peek', ontogglefull }: Props = $props();

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

	// Chassis state (peek/full/mobile presentation only — no server wiring).
	let confirmDelete = $state(false);
	let deleting = $state(false);
	let detailsSheet = $state(false);
	let checklistFoldOpen = $state(false);
	let attachmentsFoldOpen = $state(false);

	const desktop = new MediaQuery('(min-width: 768px)');
	const dur = $derived(prefersReducedMotion.current ? 0 : 200);

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

	// Focus returns to whatever opened the peek (the originating card).
	$effect(() => {
		const restore = document.activeElement as HTMLElement | null;
		return () => restore?.focus?.();
	});

	// Fresh search each time the label popover opens.
	$effect(() => {
		if (labelMenu) labelQuery = '';
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
			{ id: `tmp-${Date.now()}`, body, authorName: currentUser.displayName, authorAvatar: currentUser.avatarUrl, createdAt: new Date().toISOString() }
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
		if (archived) {
			toast.undo('Ticket archived', async () => {
				await fetch(`/api/tickets/${ticketId}/archive`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ archived: false }) });
				onchanged();
			});
			onclose();
		}
	}

	async function del() {
		deleting = true;
		await fetch(`/api/tickets/${ticketId}`, { method: 'DELETE' });
		deleting = false;
		confirmDelete = false;
		onchanged();
		onclose();
	}

	// ── Chassis helpers ──────────────────────────────────────────────────
	/** Durable share URL — resolves through the existing t/[number] redirect. */
	function ticketUrl(): string {
		const { wsSlug, projectSlug } = page.params;
		return `${location.origin}/w/${wsSlug}/p/${projectSlug}/t/${detail.number}`;
	}
	async function copyLink() {
		if (!detail) return;
		try {
			await navigator.clipboard.writeText(ticketUrl());
			toast('Link copied', { tone: 'success' });
		} catch {
			toast('Could not copy link', { tone: 'error' });
		}
	}

	const menuItems = $derived.by<MenuItem[]>(() => {
		const items: MenuItem[] = [{ label: 'Copy link', icon: Link, onselect: copyLink }];
		if (detail && access.canEdit && (detail.closedAt || detail.archived)) {
			items.push({
				label: detail.archived ? 'Restore from archive' : 'Archive ticket',
				icon: Archive,
				onselect: toggleArchive
			});
		}
		if (access.canManage) {
			items.push({ label: 'Delete ticket', icon: Trash2, danger: true, onselect: () => (confirmDelete = true) });
		}
		return items;
	});

	const ariaTitle = $derived(detail ? `Ticket #${detail.number}` : 'Ticket');

	const iconBtn = (active = false) =>
		cn(
			'focus-ring hit grid size-7 place-items-center rounded-md transition-colors',
			active
				? 'bg-[var(--accent-soft)] text-[var(--accent-fg)]'
				: 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
		);
	const chipCls =
		'focus-ring data-mono flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--ot-hairline)] px-2.5 text-neutral-600 dark:text-neutral-300';
	const foldCls =
		'focus-ring flex h-8 w-full items-center gap-1.5 rounded-md px-1 text-left text-[13px] text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200';

	function onWindowKeydown(e: KeyboardEvent) {
		if (!desktop.current || e.key !== 'Escape' || e.defaultPrevented) return;
		if (confirmDelete) return; // the dialog's own Esc handler closes it
		if (editingDesc) {
			editingDesc = false;
			descDraft = detail?.description ?? '';
			return;
		}
		onclose();
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#snippet headerMeta(kbdHint: boolean)}
	{#if kbdHint}
		<Tooltip label="j / k — next / previous ticket">
			<span class="data-mono font-medium text-neutral-600 dark:text-neutral-300">#{detail.number}</span>
		</Tooltip>
	{:else}
		<span class="data-mono font-medium text-neutral-600 dark:text-neutral-300">#{detail.number}</span>
	{/if}
	{#if detail.githubIssueNumber}
		{#if detail.githubRepo}
			<a
				href={`https://github.com/${detail.githubRepo}/issues/${detail.githubIssueNumber}`}
				target="_blank"
				rel="noreferrer"
				class="focus-ring data-mono flex items-center gap-1 rounded text-neutral-500 hover:text-neutral-800 hover:underline dark:hover:text-neutral-200"
				><Link2 size={12} /> {detail.githubIssueNumber}</a
			>
		{:else}
			<span class="data-mono flex items-center gap-1 text-neutral-500"><Link2 size={12} /> {detail.githubIssueNumber}</span>
		{/if}
	{/if}
	{#if detail.githubPrNumber}
		{@const merged = detail.githubPrState === 'merged'}
		{@const closedPr = detail.githubPrState === 'closed'}
		{@const ci = ciMeta(detail.githubCiStatus)}
		<a
			href={detail.githubRepo ? `https://github.com/${detail.githubRepo}/pull/${detail.githubPrNumber}` : '#'}
			target="_blank"
			rel="noreferrer"
			class="focus-ring rounded-full"
			title={`Pull request #${detail.githubPrNumber}${detail.githubPrState ? ' — ' + detail.githubPrState : ''}`}
		>
			<Badge tone={merged ? 'violet' : closedPr ? 'red' : 'green'} icon={merged ? GitMerge : GitPullRequest}>
				PR #{detail.githubPrNumber}
				{#if ci}<span class={`inline-block h-2 w-2 rounded-full ${ci.dotClass}`} title={ci.label}></span>{/if}
			</Badge>
		</a>
	{/if}
	{#if detail.closedAt}<Badge tone="green">Closed</Badge>{/if}
	{#if detail.archived}<Badge tone="amber">Archived</Badge>{/if}
{/snippet}

{#snippet headerActions(compact: boolean)}
	<ClickSpark class="inline-flex">
		<button
			type="button"
			onclick={toggleVote}
			aria-pressed={voted}
			class={cn(
				'focus-ring hit flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors',
				voted
					? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-fg)]'
					: 'border-[var(--ot-hairline)] text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
			)}
			title={voted ? 'Remove vote' : 'Vote for this ticket'}
		>
			<ChevronUp size={13} /><span class="data-mono">{detail.votes}</span>
		</button>
	</ClickSpark>
	<Tooltip label={watching ? 'Watching — click to stop' : 'Watch for updates'}>
		<button
			type="button"
			onclick={toggleWatch}
			aria-pressed={watching}
			aria-label={watching ? 'Stop watching this ticket' : 'Watch for updates'}
			class={iconBtn(watching)}
		>
			<Bell size={15} />
		</button>
	</Tooltip>
	{#if !compact && ontogglefull}
		<Tooltip label={presentation === 'full' ? 'Collapse to peek' : 'Full view'}>
			<button
				type="button"
				onclick={() => ontogglefull?.()}
				aria-label={presentation === 'full' ? 'Collapse to peek' : 'Open full view'}
				class={iconBtn()}
			>
				{#if presentation === 'full'}<Minimize2 size={15} />{:else}<Maximize2 size={15} />{/if}
			</button>
		</Tooltip>
	{/if}
	{#if !compact}
		<Tooltip label="Copy link">
			<button type="button" onclick={copyLink} aria-label="Copy link" class={iconBtn()}>
				<Link size={15} />
			</button>
		</Tooltip>
	{/if}
	<DropdownMenu items={menuItems} placement="bottom-end" ariaLabel="Ticket actions">
		{#snippet trigger(tp)}
			<button type="button" {...tp} aria-label="More actions" class={iconBtn()}>
				<MoreHorizontal size={15} />
			</button>
		{/snippet}
	</DropdownMenu>
	<button type="button" onclick={onclose} aria-label="Close" class={iconBtn()}>
		<X size={16} />
	</button>
{/snippet}

{#snippet mainContent()}
	<div class="flex min-w-0 flex-col gap-5">
		<!-- Title -->
		{#if editingTitle && access.canEdit}
			<!-- svelte-ignore a11y_autofocus -->
			<input
				bind:value={titleDraft}
				onblur={saveTitle}
				onkeydown={(e) => {
					if (e.key === 'Enter') saveTitle();
					else if (e.key === 'Escape') {
						e.preventDefault();
						titleDraft = detail.title;
						editingTitle = false;
					}
				}}
				autofocus
				class="focus-ring mono-display w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xl dark:border-neutral-800 dark:bg-neutral-900"
			/>
		{:else if access.canEdit}
			<h1 class="mono-display text-xl leading-tight">
				<button
					type="button"
					class="focus-ring group inline-flex max-w-full items-start gap-1.5 rounded-md text-left"
					onclick={() => (editingTitle = true)}
				>
					<span class="min-w-0">{detail.title}</span>
					<Pencil
						size={13}
						class="mt-1.5 shrink-0 text-neutral-500 group-hover:text-neutral-800 dark:text-neutral-400 dark:group-hover:text-neutral-200"
						aria-hidden="true"
					/>
				</button>
			</h1>
		{:else}
			<h1 class="mono-display text-xl leading-tight">{detail.title}</h1>
		{/if}

		<!-- Description -->
		<section>
			<div class="mb-2 flex items-center justify-between">
				<h3 class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">Description</h3>
				{#if access.canEdit && detail.description && !editingDesc}
					<button
						type="button"
						class="focus-ring hit flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
						onclick={() => (editingDesc = true)}
					>
						<Pencil size={11} /> Edit
					</button>
				{/if}
			</div>
			{#if editingDesc && access.canEdit}
				<Textarea bind:value={descDraft} rows={6} placeholder="Add a description… (markdown supported · paste or drop files)" onpaste={(e: ClipboardEvent) => onPaste(e, 'desc')} ondrop={(e: DragEvent) => { const f = filesFrom(e); if (f.length) { e.preventDefault(); void uploadFiles(f, 'desc'); } }} class="text-[13px]" />
				<div class="mt-2 flex gap-2">
					<Button size="sm" variant="primary" onclick={saveDesc}>Save</Button>
					<Button size="sm" variant="ghost" onclick={() => { editingDesc = false; descDraft = detail.description ?? ''; }}>Cancel</Button>
				</div>
			{:else if detail.description}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div class="prose prose-sm dark:prose-invert hairline max-w-none rounded-[4px] bg-[color-mix(in_srgb,var(--text)_4%,transparent)] p-3 {access.canEdit ? 'cursor-text' : ''}" onclick={() => access.canEdit && (editingDesc = true)}>
					{@html renderMarkdown(detail.description)}
				</div>
			{:else if access.canEdit}
				<button type="button" class="focus-ring w-full rounded-lg border border-dashed border-neutral-300 p-3 text-left text-[13px] text-neutral-500 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-600" onclick={() => (editingDesc = true)}>Add a description…</button>
			{:else}
				<p class="text-[13px] text-neutral-500">No description.</p>
			{/if}
			<div class="mt-3">
				<ReactionBar subjectType="ticket" subjectId={ticketId} {reactions} />
			</div>
		</section>

		<!-- Checklist — empty state collapses to a one-line fold -->
		{#if checklist.length || checklistFoldOpen}
			<section class="hairline-t pt-4">
				<div class="mb-2 flex items-center justify-between">
					<h3 class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">Checklist</h3>
					{#if checklist.length}<span class="data-mono text-neutral-500">{checklistDone}/{checklist.length}</span>{/if}
				</div>
				{#if checklist.length}
					<div class="mb-2 h-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
						<div class="h-full rounded-full bg-[var(--accent-solid)] transition-all motion-reduce:transition-none" style={`width:${Math.round((checklistDone / checklist.length) * 100)}%`}></div>
					</div>
				{/if}
				<div class="space-y-0.5">
					{#each checklist as item (item.id)}
						<div class="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
							<button
								type="button"
								onclick={() => toggleChecklistItem(item)}
								disabled={!access.canEdit}
								class={cn(
									'focus-ring grid size-4 shrink-0 place-items-center rounded border',
									item.done ? 'border-[var(--accent-solid)] bg-[var(--accent-solid)] text-white' : 'border-neutral-300 dark:border-neutral-600'
								)}
								aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
							>
								{#if item.done}<Check size={11} />{/if}
							</button>
							<span class={cn('min-w-0 flex-1 text-[13px]', item.done && 'text-neutral-500 line-through')}>{item.text}</span>
							{#if access.canEdit}
								<button type="button" onclick={() => removeChecklistItem(item.id)} class="focus-ring hit shrink-0 rounded text-neutral-500 hover:text-red-600 dark:text-neutral-400" aria-label="Remove"><X size={13} /></button>
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
							class="focus-ring h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-[13px] dark:border-neutral-800 dark:bg-neutral-900"
						/>
						<Button size="sm" variant="ghost" onclick={addChecklistItem} disabled={!checklistDraft.trim()} aria-label="Add checklist item"><Plus size={14} /></Button>
					</div>
				{/if}
			</section>
		{:else if access.canEdit}
			<button type="button" class={cn(foldCls, 'hairline-t rounded-none')} onclick={() => (checklistFoldOpen = true)} aria-expanded="false">
				<ChevronRight size={14} /> Checklist
			</button>
		{/if}

		<!-- Attachments — empty state collapses to a one-line fold -->
		{#if attachments.length || attachmentsFoldOpen}
			<section class="hairline-t pt-4">
				<div class="mb-2 flex items-center justify-between">
					<h3 class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
						Attachments{#if attachments.length}<span class="data-mono ml-1.5 normal-case">{attachments.length}</span>{/if}
					</h3>
					{#if access.canEdit}
						<label class="focus-ring cursor-pointer rounded text-[11px] text-[var(--accent-fg)] hover:underline">
							{uploading ? 'Uploading…' : 'Add files'}
							<input type="file" multiple class="hidden" onchange={(e) => { const inp = e.currentTarget; void uploadFiles(Array.from(inp.files ?? []), null).then(() => (inp.value = '')); }} />
						</label>
					{/if}
				</div>
				{#if attachments.length}
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{#each attachments as a (a.id)}
							<div class="hairline relative overflow-hidden rounded-lg">
								<a href={a.url} target="_blank" rel="noreferrer" class="focus-ring block">
									{#if a.mime.startsWith('image/')}
										<img src={a.url} alt={a.filename} class="h-24 w-full object-cover" />
									{:else}
										<div class="flex h-24 items-center gap-2 p-2">
											<Paperclip size={16} class="shrink-0 text-neutral-500" />
											<span class="min-w-0 break-words text-xs text-neutral-600 dark:text-neutral-300">{a.filename}</span>
										</div>
									{/if}
								</a>
								<div class="data-mono flex items-center justify-between px-2 py-1 text-neutral-500">
									<span class="min-w-0 truncate">{a.filename}</span>
									<span class="shrink-0">{fmtSize(a.size)}</span>
								</div>
								{#if access.canEdit}
									<button type="button" onclick={() => removeAttachment(a.id)} class="focus-ring absolute top-1 right-1 rounded bg-neutral-900/60 p-1 text-white hover:bg-neutral-900/80" aria-label="Delete attachment"><Trash2 size={12} /></button>
								{/if}
							</div>
						{/each}
					</div>
				{:else if access.canEdit}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						ondrop={onDropZone}
						ondragover={(e) => e.preventDefault()}
						class="rounded-lg border border-dashed border-neutral-300 p-4 text-center text-xs text-neutral-500 dark:border-neutral-700"
					>
						Drop files here, paste into the description, or use “Add files”.
					</div>
				{/if}
			</section>
		{:else if access.canEdit}
			<button type="button" class={cn(foldCls, 'hairline-t rounded-none')} onclick={() => (attachmentsFoldOpen = true)} aria-expanded="false">
				<ChevronRight size={14} /> Attachments
			</button>
		{/if}

		<!-- Activity / comments -->
		<section>
			<div class="divider-scan mb-3">Activity</div>
			<div class="space-y-4">
				{#each comments as c (c.id)}
					<div class="flex gap-2.5">
						<Avatar name={c.authorName ?? '?'} src={c.authorAvatar} size={24} class="mt-0.5" />
						<div class="min-w-0 flex-1">
							<div class="flex items-baseline justify-between gap-2">
								<p class="text-xs font-medium text-neutral-700 dark:text-neutral-300">{c.authorName ?? 'Unknown'}</p>
								{#if c.createdAt}<TimeAgo date={c.createdAt} />{/if}
							</div>
							<div class="prose prose-sm dark:prose-invert mt-0.5 max-w-none">{@html renderMarkdown(c.body)}</div>
							<div class="mt-1.5"><ReactionBar subjectType="comment" subjectId={c.id} reactions={c.reactions ?? []} size="sm" /></div>
						</div>
					</div>
				{:else}
					<p class="text-[13px] text-neutral-500">No comments yet.</p>
				{/each}
			</div>
		</section>
	</div>
{/snippet}

{#snippet composerBar()}
	<div class="flex items-end gap-2">
		<Textarea
			bind:value={commentDraft}
			rows={2}
			placeholder="Write a comment… (paste or drop files)"
			onpaste={(e: ClipboardEvent) => onPaste(e, 'comment')}
			onkeydown={(e: KeyboardEvent) => {
				if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
					e.preventDefault();
					void addComment();
				}
			}}
			class="min-h-9 flex-1 resize-none text-[13px]"
		/>
		<div class="flex shrink-0 items-center gap-2 pb-0.5">
			<Kbd keys={['⌘', '↵']} class="max-sm:hidden" />
			<Button size="sm" variant="primary" onclick={addComment} disabled={!commentDraft.trim()}>Send</Button>
		</div>
	</div>
{/snippet}

{#snippet propertiesRail()}
	<div class="space-y-5 text-[13px]">
		<div>
			<p class="mb-1.5 text-[11px] font-medium text-neutral-500">Status</p>
			{#if access.canEdit}
				<Select value={detail.columnId} options={columnOptions} onchange={setStatus} size="sm" />
			{:else}
				<span>{columns.find((c) => c.id === detail.columnId)?.name ?? '—'}</span>
			{/if}
		</div>

		<div>
			<p class="mb-1.5 text-[11px] font-medium text-neutral-500">Priority</p>
			{#if access.canEdit}
				<Select value={detail.priority} options={priorityOptions} onchange={setPriority} size="sm" />
			{:else}
				<span>{PRIORITY_META[detail.priority as Priority].label}</span>
			{/if}
		</div>

		{#if milestones.length || detail.milestone}
			<div>
				<p class="mb-1.5 text-[11px] font-medium text-neutral-500">Milestone</p>
				{#if access.canEdit}
					<Select value={detail.milestoneId ?? ''} options={milestoneOptions} onchange={setMilestone} size="sm" />
				{:else}
					<span>{detail.milestone?.title ?? '—'}</span>
				{/if}
			</div>
		{/if}

		<div>
			<p class="mb-1.5 text-[11px] font-medium text-neutral-500">Assignees</p>
			<div class="flex flex-wrap items-center gap-1">
				{#each detail.assignees as a (a.userId ?? a.githubLogin)}
					<span class="hairline flex items-center gap-1 rounded-full bg-white py-0.5 pr-2 pl-0.5 text-xs dark:bg-neutral-800" title={a.githubLogin ? `@${a.githubLogin}` : a.displayName}>
						<Avatar name={a.displayName} src={a.avatarUrl} size={16} />
						{a.displayName}
						{#if a.githubLogin}<span class="text-neutral-500">@{a.githubLogin}</span>{/if}
					</span>
				{/each}
				{#if access.canEdit}
					<Popover bind:open={assigneeMenu} placement="bottom-start" class="w-56 p-1">
						{#snippet trigger(tp)}
							<button
								type="button"
								{...tp}
								class="focus-ring hit grid size-6 place-items-center rounded-full border border-dashed border-neutral-400 text-neutral-500 hover:border-neutral-500 hover:text-neutral-700 dark:border-neutral-600 dark:text-neutral-400 dark:hover:text-neutral-200"
								aria-label="Edit assignees"
							>
								<Plus size={12} />
							</button>
						{/snippet}
						{#snippet content()}
							<div class="max-h-56 overflow-y-auto">
								{#each members as m (m.userId)}
									<button type="button" onclick={() => toggleAssignee(m.userId)} class="focus-ring flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800">
										<Avatar name={m.displayName} src={m.avatarUrl} size={16} />
										<span class="min-w-0 flex-1 truncate">{m.displayName}</span>
										{#if isAssigned(m.userId)}<Check size={13} class="shrink-0 text-[var(--accent-fg)]" />{/if}
									</button>
								{:else}
									<p class="px-2 py-2 text-xs text-neutral-500">No members.</p>
								{/each}
							</div>
						{/snippet}
					</Popover>
				{/if}
			</div>
		</div>

		<div>
			<p class="mb-1.5 text-[11px] font-medium text-neutral-500">Labels</p>
			<div class="flex flex-wrap items-center gap-1">
				{#each detail.labels as l (l.id)}
					<span class="rounded px-1.5 py-0.5 text-[10px] font-medium" style={`background:${l.color}22;color:${l.color}`}>{l.name}</span>
				{/each}
				{#if access.canEdit}
					<Popover bind:open={labelMenu} placement="bottom-start" class="w-64 p-2">
						{#snippet trigger(tp)}
							<button
								type="button"
								{...tp}
								class="focus-ring hit grid size-5 place-items-center rounded border border-dashed border-neutral-400 text-neutral-500 hover:border-neutral-500 hover:text-neutral-700 dark:border-neutral-600 dark:text-neutral-400 dark:hover:text-neutral-200"
								aria-label="Edit labels"
							>
								<Plus size={12} />
							</button>
						{/snippet}
						{#snippet content()}
							<!-- svelte-ignore a11y_autofocus -->
							<input bind:value={labelQuery} autofocus placeholder="Search or create a label…" onkeydown={(e) => e.key === 'Enter' && createLabel()} class="focus-ring mb-2 w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900" />
							<div class="max-h-40 overflow-y-auto">
								{#each filteredLabels as l (l.id)}
									<button type="button" onclick={() => toggleLabel(l.id)} class="focus-ring flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800">
										<span class="size-3 shrink-0 rounded-full" style={`background:${l.color}`}></span>
										<span class="min-w-0 flex-1 truncate">{l.name}</span>
										{#if hasLabel(l.id)}<Check size={13} class="shrink-0 text-[var(--accent-fg)]" />{/if}
									</button>
								{:else}
									{#if !labelQuery.trim()}<p class="px-2 py-2 text-xs text-neutral-500">No labels yet — type to create one.</p>{/if}
								{/each}
							</div>
							<!-- Create when the typed name doesn't already exist -->
							{#if labelQuery.trim() && !labelExactMatch}
								<div class="hairline-t mt-1.5 pt-2">
									<div class="mb-2 flex flex-wrap items-center gap-1.5">
										{#each PALETTE as c (c)}
											<button type="button" onclick={() => (newLabelColor = c)} class="focus-ring size-5 rounded-full ring-offset-1 ring-offset-white transition dark:ring-offset-neutral-900" class:ring-2={newLabelColor === c} style={`background:${c};--tw-ring-color:${c}`} aria-label={`Use ${c}`}></button>
										{/each}
									</div>
									<button type="button" onclick={createLabel} class="focus-ring flex w-full items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-1.5 text-xs font-medium hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700">
										<Plus size={12} /> Create
										<span class="ml-0.5 max-w-[9rem] truncate rounded px-1.5 py-0.5 text-[10px] font-medium" style={`background:${newLabelColor}22;color:${newLabelColor}`}>{labelQuery.trim()}</span>
									</button>
								</div>
							{/if}
						{/snippet}
					</Popover>
				{/if}
			</div>
		</div>

		{#if fields.length}
			{@const fieldCls = 'focus-ring h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-[13px] dark:border-neutral-800 dark:bg-neutral-900'}
			<div>
				<p class="mb-1.5 text-[11px] font-medium text-neutral-500">Fields</p>
				<div class="space-y-2">
					{#each fields as f (f.id)}
						<div>
							<span class="mb-0.5 block text-[11px] text-neutral-500">{f.name}</span>
							{#if !access.canEdit}
								<p class="text-[13px]">{f.type === 'checkbox' ? (f.value === 'true' ? 'Yes' : 'No') : (f.value || '—')}</p>
							{:else if f.type === 'select'}
								<select value={f.value ?? ''} onchange={(e) => setField(f.id, e.currentTarget.value)} class={fieldCls}>
									<option value="">—</option>
									{#each f.options ?? [] as o (o)}<option value={o}>{o}</option>{/each}
								</select>
							{:else if f.type === 'checkbox'}
								<input type="checkbox" checked={f.value === 'true'} onchange={(e) => setField(f.id, e.currentTarget.checked ? 'true' : 'false')} class="focus-ring size-4 rounded accent-[var(--accent-solid)]" />
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
			<p class="mb-1.5 text-[11px] font-medium text-neutral-500">Relations</p>
			<div class="space-y-1">
				{#each detail.relations as r (r.id)}
					<div class="flex items-center gap-1.5 text-xs">
						<span class="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">{r.label}</span>
						<span class="data-mono shrink-0 text-neutral-500">#{r.targetNumber}</span>
						<span class="min-w-0 flex-1 truncate">{r.targetTitle}</span>
						{#if access.canEdit}<button type="button" onclick={() => removeRelation(r.id)} class="focus-ring hit shrink-0 rounded text-neutral-500 hover:text-red-600" aria-label="Remove"><X size={12} /></button>{/if}
					</div>
				{:else}
					<p class="text-xs text-neutral-500">No linked tickets.</p>
				{/each}
			</div>
			{#if access.canEdit}
				<div class="relative mt-2">
					<Select bind:value={relType} options={relOptions} size="sm" class="mb-1.5 w-full" />
					<div class="focus-within:border-[var(--accent-solid)] flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 dark:border-neutral-800 dark:bg-neutral-900">
						<Search size={13} class="shrink-0 text-neutral-500" />
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
								<p class="px-2 py-2 text-xs text-neutral-500">Searching…</p>
							{/if}
							{#each relResults as t (t.id)}
								<button type="button" onclick={() => pickRelation(t.id)} class="focus-ring flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800">
									<span class="data-mono shrink-0 text-neutral-500">#{t.number}</span>
									<span class="min-w-0 flex-1 truncate">{t.title}</span>
									{#if t.closedAt}<span class="shrink-0 text-[10px] text-neutral-500">closed</span>{/if}
								</button>
							{/each}
							{#if !relSearching && !relResults.length}
								<p class="px-2 py-2 text-xs text-neutral-500">No matching tickets.</p>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		{#if detail.githubRepo}
			<div>
				<p class="mb-1.5 text-[11px] font-medium text-neutral-500">GitHub</p>
				{#if detail.githubIssueNumber}
					<a
						href={`https://github.com/${detail.githubRepo}/issues/${detail.githubIssueNumber}`}
						target="_blank"
						rel="noreferrer"
						class="focus-ring hairline flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] hover:bg-neutral-50 dark:hover:bg-neutral-800"
					>
						<Link2 size={14} class="text-neutral-500" /> Issue #{detail.githubIssueNumber}
						<ExternalLink size={12} class="ml-auto text-neutral-500" />
					</a>
				{/if}
				{#if detail.githubPrNumber}
					{@const ci = ciMeta(detail.githubCiStatus)}
					<div class="hairline mt-1.5 rounded-md">
						<a
							href={`https://github.com/${detail.githubRepo}/pull/${detail.githubPrNumber}`}
							target="_blank"
							rel="noreferrer"
							class="focus-ring flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] hover:bg-neutral-50 dark:hover:bg-neutral-800"
						>
							{#if detail.githubPrState === 'merged'}<GitMerge size={14} class="text-violet-500" />{:else}<GitPullRequest size={14} class={detail.githubPrState === 'closed' ? 'text-red-400' : 'text-green-500'} />{/if}
							PR #{detail.githubPrNumber}
							{#if detail.githubPrState}<span class="text-xs text-neutral-500">{detail.githubPrState}</span>{/if}
							<ExternalLink size={12} class="ml-auto text-neutral-500" />
						</a>
						{#if detail.githubPrHeadRef || ci}
							<div class="hairline-t flex items-center gap-2 px-2.5 py-1.5">
								{#if detail.githubPrHeadRef}
									<span class="flex min-w-0 items-center gap-1 text-xs text-neutral-500" title={detail.githubPrHeadRef}>
										<GitBranch size={12} class="shrink-0 text-neutral-500" />
										<span class="data-mono truncate">{detail.githubPrHeadRef}</span>
									</span>
								{/if}
								{#if ci}
									<span class={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${ci.pillClass}`}>{ci.label}</span>
								{/if}
							</div>
						{/if}
						{#if access.canEdit && detail.githubPrLinkSource === 'manual'}
							<button
								type="button"
								onclick={unlinkPR}
								class="focus-ring hairline-t flex w-full items-center gap-1.5 px-2.5 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50 hover:text-red-600 dark:hover:bg-neutral-800"
							>
								<Unlink size={12} /> Unlink PR
							</button>
						{/if}
					</div>
				{:else if access.canEdit}
					<div class="relative mt-1.5" use:clickOutside={() => (prMenu = false)}>
						<button
							type="button"
							onclick={() => { prMenu = !prMenu; if (prMenu && prResults.length === 0) searchPRs(); }}
							class="focus-ring flex w-full items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-2.5 py-1.5 text-[13px] text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
							disabled={prLinking}
						>
							<GitPullRequest size={14} class="text-neutral-500" /> {prLinking ? 'Linking…' : 'Link a pull request'}
						</button>
						{#if prMenu}
							<div class="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
								<div class="hairline-b flex items-center gap-1.5 px-1.5 pb-1.5">
									<Search size={13} class="text-neutral-500" />
									<input
										bind:value={prQuery}
										oninput={searchPRs}
										placeholder="Search open PRs…"
										class="w-full bg-transparent text-[13px] outline-none placeholder:text-neutral-400"
									/>
								</div>
								<div class="max-h-52 overflow-y-auto pt-1">
									{#if prSearching}
										<p class="px-2 py-1.5 text-xs text-neutral-500">Searching…</p>
									{:else if prResults.length === 0}
										<p class="px-2 py-1.5 text-xs text-neutral-500">No open pull requests found.</p>
									{:else}
										{#each prResults as pr (pr.number)}
											<button
												type="button"
												onclick={() => linkPR(pr.number)}
												class="focus-ring flex w-full items-start gap-1.5 rounded px-2 py-1.5 text-left text-[13px] hover:bg-neutral-100 dark:hover:bg-neutral-800"
											>
												<GitPullRequest size={13} class="mt-0.5 shrink-0 text-green-500" />
												<span class="min-w-0">
													<span class="block truncate">{pr.title}</span>
													<span class="data-mono block truncate text-neutral-500">#{pr.number}{pr.headRef ? ' · ' + pr.headRef : ''}{pr.draft ? ' · draft' : ''}</span>
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

		<div class="hairline-t space-y-1 pt-3 text-[11px] text-neutral-500">
			<p class="flex flex-wrap items-center gap-1">
				Opened
				{#if detail.createdAt}<TimeAgo date={detail.createdAt} />{/if}
				{#if detail.authorName}by {detail.authorName}{/if}
			</p>
			{#if detail.closedAt}
				<p class="flex items-center gap-1">Closed <TimeAgo date={detail.closedAt} /></p>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet loadingMain()}
	<div class="flex flex-col gap-6">
		<Skeleton lines={1} class="max-w-sm" />
		<Skeleton lines={5} />
	</div>
{/snippet}

{#snippet loadingRail()}
	<div class="space-y-5">
		{#each ['Status', 'Priority', 'Milestone', 'Assignees', 'Labels'] as l (l)}
			<div>
				<p class="mb-1.5 text-[11px] font-medium text-neutral-500">{l}</p>
				<Skeleton lines={1} />
			</div>
		{/each}
	</div>
{/snippet}

{#if desktop.current}
	{#if presentation === 'full'}
		<!-- Tier 3 — full page: centered GitHub-issue layout, same data layer. -->
		<div
			class="fixed inset-0 z-40 overflow-y-auto bg-[var(--ground)]"
			role="dialog"
			aria-label={ariaTitle}
			transition:fade={{ duration: dur / 2 }}
		>
			<div class="hairline-b sticky top-0 z-10 flex h-12 items-center gap-2 bg-[var(--ground)] px-4">
				{#if detail}
					{@render headerMeta(false)}
					<div class="ml-auto flex items-center gap-1">{@render headerActions(false)}</div>
				{:else}
					<Skeleton lines={1} class="w-24" />
					<button type="button" onclick={onclose} aria-label="Close" class={cn(iconBtn(), 'ml-auto')}><X size={16} /></button>
				{/if}
			</div>
			<div class="mx-auto grid w-full max-w-6xl gap-8 px-6 py-6 md:grid-cols-[minmax(0,1fr)_19rem]">
				<div class="min-w-0">
					{#if loading || !detail}
						{@render loadingMain()}
					{:else}
						{@render mainContent()}
						<div class="hairline-t mt-6 pt-4">{@render composerBar()}</div>
					{/if}
				</div>
				<aside class="min-w-0 md:sticky md:top-16 md:max-h-[calc(100dvh-5rem)] md:self-start md:overflow-y-auto">
					{#if loading || !detail}
						{@render loadingRail()}
					{:else}
						{@render propertiesRail()}
					{/if}
				</aside>
			</div>
		</div>
	{:else}
		<!-- Tier 2 — peek: 760px right slide-over. Backdrop <xl only; at ≥xl the
		     board behind stays interactive (j/k lives there). -->
		<button
			type="button"
			aria-label="Close"
			class="fixed inset-0 z-40 bg-neutral-950/40 backdrop-blur-[2px] xl:hidden"
			onclick={onclose}
			transition:fade={{ duration: dur / 2 }}
		></button>
		<div
			role="dialog"
			aria-label={ariaTitle}
			class="hairline-l fixed inset-y-0 right-0 z-40 grid w-[min(760px,100vw)] grid-cols-[minmax(0,1fr)_16rem] grid-rows-[auto_minmax(0,1fr)_auto] bg-white shadow-2xl dark:bg-neutral-900"
			transition:fly={{ x: '100%', duration: dur, easing: expoOut, opacity: 1 }}
		>
			<header class="hairline-b col-span-2 flex h-12 items-center gap-2 px-3">
				{#if detail}
					{@render headerMeta(true)}
					<div class="ml-auto flex items-center gap-1">{@render headerActions(false)}</div>
				{:else}
					<Skeleton lines={1} class="w-20" />
					<button type="button" onclick={onclose} aria-label="Close" class={cn(iconBtn(), 'ml-auto')}><X size={16} /></button>
				{/if}
			</header>
			<div class="min-h-0 overflow-y-auto px-5 py-4">
				{#if loading || !detail}
					{@render loadingMain()}
				{:else}
					{@render mainContent()}
				{/if}
			</div>
			<div class="hairline-l min-h-0 overflow-y-auto bg-[var(--ground)] px-4 py-4">
				{#if loading || !detail}
					{@render loadingRail()}
				{:else}
					{@render propertiesRail()}
				{/if}
			</div>
			{#if detail}
				<div class="hairline-t col-span-2 p-3">{@render composerBar()}</div>
			{/if}
		</div>
	{/if}
{:else}
	<!-- Mobile: full-screen sheet; properties live in a chip strip + bottom sheet. -->
	<Sheet
		open={true}
		side="right"
		size="full"
		ariaLabel={ariaTitle}
		onclose={() => {
			if (!detailsSheet) onclose();
		}}
		class="flex flex-col overflow-hidden"
	>
		<header class="hairline-b flex h-12 shrink-0 items-center gap-2 px-3">
			{#if detail}
				{@render headerMeta(false)}
				<div class="ml-auto flex items-center gap-1">{@render headerActions(true)}</div>
			{:else}
				<Skeleton lines={1} class="w-20" />
				<button type="button" onclick={onclose} aria-label="Close" class={cn(iconBtn(), 'ml-auto')}><X size={16} /></button>
			{/if}
		</header>
		{#if detail}
			{@const col = columns.find((c) => c.id === detail.columnId)}
			<div class="hairline-b flex shrink-0 items-center gap-2 overflow-x-auto px-3 py-2">
				<button type="button" class={chipCls} onclick={() => (detailsSheet = true)}>
					{#if col}<span class="size-2 shrink-0 rounded-full" style={`background:${col.color}`}></span>{/if}
					{col?.name ?? '—'}
				</button>
				<button type="button" class={chipCls} onclick={() => (detailsSheet = true)}>
					{PRIORITY_META[detail.priority as Priority].label}
				</button>
				<button type="button" class={chipCls} onclick={() => (detailsSheet = true)}>
					{#if detail.assignees.length}
						<AvatarStack users={detail.assignees.map((a: any) => ({ name: a.displayName, src: a.avatarUrl }))} size={16} />
					{:else}
						Assign
					{/if}
				</button>
				<button type="button" class={cn(chipCls, 'ml-auto')} onclick={() => (detailsSheet = true)}>
					Details <ChevronRight size={12} />
				</button>
			</div>
		{/if}
		<div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
			{#if loading || !detail}
				{@render loadingMain()}
			{:else}
				{@render mainContent()}
			{/if}
		</div>
		{#if detail}
			<div class="hairline-t shrink-0 p-3">{@render composerBar()}</div>
		{/if}
	</Sheet>

	<Sheet bind:open={detailsSheet} side="bottom" size="md" ariaLabel="Ticket details" class="p-4">
		{#if detail}
			{@render propertiesRail()}
		{/if}
	</Sheet>
{/if}

<Dialog bind:open={confirmDelete} title="Delete ticket" description={detail ? `#${detail.number} — ${detail.title}` : undefined} size="sm">
	<p class="text-[13px] text-neutral-600 dark:text-neutral-300">
		This permanently deletes the ticket, its comments and attachments.
	</p>
	{#snippet footer()}
		<Button variant="ghost" type="button" onclick={() => (confirmDelete = false)}>Cancel</Button>
		<Button variant="danger" type="button" loading={deleting} onclick={del}>Delete</Button>
	{/snippet}
</Dialog>
