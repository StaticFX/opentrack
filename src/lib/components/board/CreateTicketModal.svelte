<script lang="ts">
	import { X, Check } from '@lucide/svelte';
	import { PRIORITIES, type Priority } from '$lib/constants';
	import { PRIORITY_META } from '$lib/priority';
	import Button from '$lib/components/ui/Button.svelte';
	import Select from '$lib/components/ui/Select.svelte';

	type ColumnDef = { id: string; name: string; color: string };
	type LabelDef = { id: string; name: string; color: string };
	type Props = {
		boardId: string;
		projectId: string;
		columns: ColumnDef[];
		labels: LabelDef[];
		defaultColumnId?: string;
		onclose: () => void;
		oncreated: () => void;
	};
	let { boardId, projectId, columns, labels, defaultColumnId, onclose, oncreated }: Props = $props();

	let title = $state('');
	let description = $state('');
	let priority = $state<Priority>('none');
	let columnId = $state(defaultColumnId ?? columns[0]?.id ?? '');
	let milestoneId = $state('');
	let selLabels = $state<string[]>([]);
	let selAssignees = $state<string[]>([]);
	let members = $state<Array<{ userId: string; displayName: string; avatarUrl: string | null }>>([]);
	let milestones = $state<Array<{ id: string; title: string; state: string }>>([]);
	let saving = $state(false);
	let error = $state('');
	let titleEl = $state<HTMLInputElement | null>(null);

	const jsonHeaders = { 'content-type': 'application/json' };
	const priorityOptions = PRIORITIES.map((p) => ({
		value: p,
		label: PRIORITY_META[p].label,
		color: p === 'none' ? undefined : PRIORITY_META[p].color
	}));
	const columnOptions = $derived(columns.map((c) => ({ value: c.id, label: c.name, color: c.color })));
	const milestoneOptions = $derived([
		{ value: '', label: 'No milestone' },
		...milestones.map((m) => ({ value: m.id, label: m.state === 'closed' ? `${m.title} (closed)` : m.title }))
	]);

	$effect(() => {
		titleEl?.focus();
	});

	// Load assignable members + milestones for the pickers.
	$effect(() => {
		let alive = true;
		(async () => {
			const [mRes, msRes] = await Promise.all([
				fetch(`/api/projects/${projectId}/members`),
				fetch(`/api/projects/${projectId}/milestones`)
			]);
			if (!alive) return;
			if (mRes.ok) members = (await mRes.json()).members ?? [];
			if (msRes.ok) milestones = (await msRes.json()).milestones ?? [];
		})();
		return () => {
			alive = false;
		};
	});

	function toggle(list: string[], id: string): string[] {
		return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
	}

	async function submit() {
		const t = title.trim();
		if (!t) {
			error = 'Title is required';
			return;
		}
		if (!columnId) {
			error = 'Pick a column';
			return;
		}
		saving = true;
		error = '';
		const res = await fetch(`/api/boards/${boardId}/tickets`, {
			method: 'POST',
			headers: jsonHeaders,
			body: JSON.stringify({
				columnId,
				title: t,
				description: description.trim() || undefined,
				priority,
				labels: selLabels,
				assignees: selAssignees
			})
		});
		if (!res.ok) {
			error = (await res.json().catch(() => ({}))).message ?? 'Could not create ticket';
			saving = false;
			return;
		}
		// Attach a milestone (separate endpoint) if one was chosen.
		if (milestoneId) {
			const { id } = await res.json();
			await fetch(`/api/tickets/${id}/milestone`, {
				method: 'POST',
				headers: jsonHeaders,
				body: JSON.stringify({ milestoneId })
			}).catch(() => {});
		}
		saving = false;
		oncreated();
		onclose();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
		// Cmd/Ctrl+Enter submits from anywhere in the form.
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			void submit();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]">
	<button type="button" aria-label="Close" class="absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px]" onclick={onclose}></button>
	<div class="relative z-10 flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
		<div class="flex items-center justify-between border-b border-neutral-100 px-5 py-3 dark:border-neutral-800">
			<h2 class="text-sm font-semibold">New ticket</h2>
			<button onclick={onclose} class="rounded p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Close"><X size={16} /></button>
		</div>

		<div class="flex-1 overflow-y-auto px-5 py-4">
			<!-- svelte-ignore a11y_autofocus -->
			<input
				bind:this={titleEl}
				bind:value={title}
				placeholder="Ticket title"
				class="mb-3 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:border-neutral-700 dark:bg-neutral-900"
			/>
			<textarea
				bind:value={description}
				placeholder="Description (markdown supported)…"
				rows="4"
				class="mb-4 w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:border-neutral-700 dark:bg-neutral-900"
			></textarea>

			<div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
				<label class="block">
					<span class="mb-1 block text-xs font-medium text-neutral-400">Column</span>
					<Select bind:value={columnId} options={columnOptions} size="sm" />
				</label>
				<label class="block">
					<span class="mb-1 block text-xs font-medium text-neutral-400">Priority</span>
					<Select bind:value={priority} options={priorityOptions} size="sm" />
				</label>
				<label class="block">
					<span class="mb-1 block text-xs font-medium text-neutral-400">Milestone</span>
					<Select bind:value={milestoneId} options={milestoneOptions} size="sm" placeholder="No milestone" />
				</label>
			</div>

			{#if labels.length}
				<div class="mb-4">
					<span class="mb-1.5 block text-xs font-medium text-neutral-400">Labels</span>
					<div class="flex flex-wrap gap-1.5">
						{#each labels as l (l.id)}
							{@const on = selLabels.includes(l.id)}
							<button
								onclick={() => (selLabels = toggle(selLabels, l.id))}
								class={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${on ? 'border-transparent text-white' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
								style={on ? `background:${l.color}` : ''}
							>
								{#if on}<Check size={11} />{/if}{l.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			{#if members.length}
				<div>
					<span class="mb-1.5 block text-xs font-medium text-neutral-400">Assignees</span>
					<div class="flex flex-wrap gap-1.5">
						{#each members as m (m.userId)}
							{@const on = selAssignees.includes(m.userId)}
							<button
								onclick={() => (selAssignees = toggle(selAssignees, m.userId))}
								class={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${on ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
							>
								{#if m.avatarUrl}
									<img src={m.avatarUrl} alt="" class="size-4 rounded-full" />
								{:else}
									<span class="grid size-4 place-items-center rounded-full bg-neutral-300 text-[8px] font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">{m.displayName.slice(0, 1).toUpperCase()}</span>
								{/if}
								{m.displayName}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<div class="flex items-center justify-between gap-3 border-t border-neutral-100 px-5 py-3 dark:border-neutral-800">
			{#if error}<span class="text-sm text-red-600">{error}</span>{:else}<span class="text-xs text-neutral-400">⌘↵ to create</span>{/if}
			<div class="flex items-center gap-2">
				<Button variant="ghost" size="sm" onclick={onclose}>Cancel</Button>
				<Button variant="primary" size="sm" onclick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create ticket'}</Button>
			</div>
		</div>
	</div>
</div>
