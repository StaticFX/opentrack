<script lang="ts">
	import { ChevronRight, Plus, Inbox as InboxIcon, ChevronUp, MessageSquare } from '@lucide/svelte';
	import type { TicketCard } from '$lib/board';
	import { PRIORITY_META } from '$lib/priority';
	import { dueMeta } from '$lib/time';
	import ColumnIcon from './ColumnIcon.svelte';
	import AvatarStack from '$lib/components/ui/AvatarStack.svelte';
	import EmptyStateApp from '$lib/components/ui/EmptyStateApp.svelte';
	import { cn } from '$lib/utils/cn';

	type ColGroup = {
		id: string;
		name: string;
		color: string;
		icon: string | null;
		wipLimit: number | null;
		items: TicketCard[];
	};
	type Props = {
		columns: ColGroup[];
		canEdit: boolean;
		onopen: (id: string) => void;
		/** Per-column quick-add — omitted (no button) when create isn't wired. */
		oncreate?: (columnId: string) => void;
	};
	let { columns, canEdit, onopen, oncreate }: Props = $props();

	// Sections default open — collapse is a per-viewer scan aid, not a saved preference.
	let collapsed = $state<Record<string, boolean>>({});
	function toggle(id: string) {
		collapsed[id] = !collapsed[id];
	}

	const PRIORITY_SHORT: Partial<Record<string, string>> = { low: 'Low', medium: 'Med', high: 'High', urgent: 'Urg' };
</script>

{#if columns.length === 0}
	<div class="px-4 py-6">
		<EmptyStateApp icon={InboxIcon} title="No columns yet." body="Add a column to start tracking tickets." />
	</div>
{:else}
	<div class="flex flex-col">
		{#each columns as col (col.id)}
			{@const over = col.wipLimit != null && col.items.length > col.wipLimit}
			{@const open = !collapsed[col.id]}
			<div class="hairline-b">
				<div
					class={cn(
						'sticky top-0 z-10 flex h-10 items-center gap-2 px-3',
						over ? 'bg-[color-mix(in_srgb,var(--amber)_14%,var(--raised))]' : 'bg-[var(--raised)]'
					)}
				>
					<button
						type="button"
						onclick={() => toggle(col.id)}
						aria-expanded={open}
						class="focus-ring hit -ml-1 flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left"
					>
						<ChevronRight size={14} class={cn('shrink-0 text-neutral-400 transition-transform', open && 'rotate-90')} aria-hidden="true" />
						<ColumnIcon icon={col.icon} color={col.color} />
						<span class="mono-display truncate text-[13px]">{col.name}</span>
						<span class={cn('data-mono shrink-0', over ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-neutral-500 dark:text-neutral-400')}>
							{col.items.length}{col.wipLimit != null ? `/${col.wipLimit}` : ''}
						</span>
					</button>
					{#if canEdit && oncreate}
						<button
							type="button"
							onclick={() => oncreate(col.id)}
							class="focus-ring hit shrink-0 rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
							aria-label={`New ticket in ${col.name}`}
						>
							<Plus size={14} />
						</button>
					{/if}
				</div>

				{#if open}
					{#if col.items.length === 0}
						<p class="px-4 py-3 text-[13px] text-neutral-500">No tickets.</p>
					{:else}
						{#each col.items as ticket (ticket.id)}
							{@const due = dueMeta(ticket.dueDate)}
							{@const assignees = ticket.assignees.map((a) => ({ name: a.displayName, src: a.avatarUrl }))}
							<button
								type="button"
								onclick={() => onopen(ticket.id)}
								class="focus-ring relative flex w-full flex-col gap-1 py-2.5 pr-3 pl-4 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
							>
								{#if ticket.priority !== 'none'}
									<span class="absolute inset-y-0 left-0 w-[2px]" style={`background:${PRIORITY_META[ticket.priority].color}`} aria-hidden="true"></span>
								{/if}
								<span class={cn('truncate text-[13px]', ticket.archived ? 'text-neutral-400' : 'text-neutral-800 dark:text-neutral-100')}>
									{ticket.title}
								</span>
								<span class="data-mono flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
									<span>#{ticket.number}</span>
									{#if ticket.priority !== 'none'}<span>{PRIORITY_SHORT[ticket.priority]}</span>{/if}
									{#if due}
										<span class={cn(due.overdue ? 'text-red-500' : due.soon ? 'text-amber-600 dark:text-amber-400' : '')}>{due.label}</span>
									{/if}
									<span class="flex-1"></span>
									{#if ticket.votes > 0}<span class="flex items-center gap-0.5"><ChevronUp size={11} /> {ticket.votes}</span>{/if}
									{#if ticket.comments > 0}<span class="flex items-center gap-0.5"><MessageSquare size={10} /> {ticket.comments}</span>{/if}
									{#if assignees.length}<AvatarStack users={assignees} size={16} max={3} />{/if}
								</span>
							</button>
						{/each}
					{/if}
				{/if}
			</div>
		{/each}
	</div>
{/if}
