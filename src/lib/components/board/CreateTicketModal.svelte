<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { PRIORITIES, type Priority } from '$lib/constants';
	import { PRIORITY_META } from '$lib/priority';
	import { cn } from '$lib/utils/cn';
	import Button from '$lib/components/ui/Button.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Kbd from '$lib/components/ui/Kbd.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';

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

	// The Dialog owns Esc/backdrop/✕; the parent unmounts on onclose.
	let open = $state(true);
	$effect(() => {
		if (!open) onclose();
	});

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
		// Cmd/Ctrl+Enter submits from anywhere in the form.
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			void submit();
		}
	}

	const pillOff =
		'border-[var(--ot-hairline)] text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800';
</script>

<svelte:window onkeydown={onKeydown} />

<Dialog bind:open title="New ticket" size="lg" align="top">
	<input
		bind:value={title}
		placeholder="Ticket title"
		aria-label="Ticket title"
		class="focus-ring mb-3 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-[13px] font-medium dark:border-neutral-800 dark:bg-neutral-900"
	/>
	<textarea
		bind:value={description}
		placeholder="Description (markdown supported)…"
		aria-label="Description"
		rows="4"
		class="focus-ring mb-4 w-full resize-y rounded-md border border-neutral-200 bg-white px-3 py-2 text-[13px] dark:border-neutral-800 dark:bg-neutral-900"
	></textarea>

	<div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
		<Field label="Column">
			<Select bind:value={columnId} options={columnOptions} size="sm" />
		</Field>
		<Field label="Priority">
			<Select bind:value={priority} options={priorityOptions} size="sm" />
		</Field>
		<Field label="Milestone">
			<Select bind:value={milestoneId} options={milestoneOptions} size="sm" placeholder="No milestone" />
		</Field>
	</div>

	{#if labels.length}
		<div class="mb-4">
			<span class="mb-1.5 block text-[11px] font-medium text-neutral-500">Labels</span>
			<div class="flex flex-wrap gap-1.5">
				{#each labels as l (l.id)}
					{@const on = selLabels.includes(l.id)}
					<button
						type="button"
						aria-pressed={on}
						onclick={() => (selLabels = toggle(selLabels, l.id))}
						class={cn(
							'focus-ring flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
							on ? 'border-transparent text-white' : pillOff
						)}
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
			<span class="mb-1.5 block text-[11px] font-medium text-neutral-500">Assignees</span>
			<div class="flex flex-wrap gap-1.5">
				{#each members as m (m.userId)}
					{@const on = selAssignees.includes(m.userId)}
					<button
						type="button"
						aria-pressed={on}
						onclick={() => (selAssignees = toggle(selAssignees, m.userId))}
						class={cn(
							'focus-ring flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs',
							on
								? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-fg)]'
								: pillOff
						)}
					>
						<Avatar name={m.displayName} src={m.avatarUrl} size={16} />
						{m.displayName}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#snippet footer()}
		{#if error}
			<span class="mr-auto self-center text-[13px] text-red-600">{error}</span>
		{:else}
			<span class="mr-auto flex items-center gap-1 self-center text-[11px] text-neutral-500">
				<Kbd keys={['⌘', '↵']} /> to create
			</span>
		{/if}
		<Button variant="ghost" size="sm" onclick={() => (open = false)}>Cancel</Button>
		<Button variant="primary" size="sm" onclick={submit} loading={saving}>Create ticket</Button>
	{/snippet}
</Dialog>
