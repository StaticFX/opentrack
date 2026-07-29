<script lang="ts">
	import { MessageSquare, ChevronUp, Link2, Waypoints, AlignLeft, Ban, GitPullRequest, GitMerge, Clock } from '@lucide/svelte';
	import { ciMeta } from '$lib/github-ci';
	import type { TicketCard } from '$lib/board';
	import { PRIORITY_META } from '$lib/priority';
	import { dueMeta } from '$lib/time';
	import AvatarStack from '$lib/components/ui/AvatarStack.svelte';
	import { cn } from '$lib/utils/cn';

	type Props = {
		ticket: TicketCard;
		onopen: (id: string) => void;
		/** Drag is currently unavailable (filter/select/view-only) — drops hover-lift, no grab affordance. */
		dragDisabled?: boolean;
		/** One-shot "a teammate just changed this" pulse (SSE-driven). */
		flash?: boolean;
	};
	let { ticket, onopen, dragDisabled = false, flash = false }: Props = $props();

	// Priority carries color (left edge, quick scan) AND a text label (meta row) —
	// color-only encoding was the a11y gap in the previous card.
	const PRIORITY_SHORT: Partial<Record<string, string>> = { low: 'Low', medium: 'Med', high: 'High', urgent: 'Urg' };
	const due = $derived(dueMeta(ticket.dueDate));
	const assignees = $derived(ticket.assignees.map((a) => ({ name: a.displayName, src: a.avatarUrl })));
	const shownLabels = $derived(ticket.labels.slice(0, 2));
	const extraLabels = $derived(ticket.labels.length - shownLabels.length);
</script>

<div
	role="button"
	tabindex="0"
	onclick={() => onopen(ticket.id)}
	onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onopen(ticket.id)}
	class={cn(
		'focus-ring relative flex cursor-pointer flex-col gap-1.5 overflow-hidden rounded-[3px] border border-[var(--rule)] bg-[var(--raised)] p-2.5 transition-colors duration-150',
		!dragDisabled && 'hover:border-[color-mix(in_srgb,var(--accent)_45%,transparent)]',
		ticket.archived && 'opacity-60',
		flash && 'ot-flash'
	)}
>
	{#if ticket.priority !== 'none'}
		<span
			class="absolute inset-y-0 left-0 w-[2px]"
			style={`background:${PRIORITY_META[ticket.priority].color}`}
			aria-hidden="true"
		></span>
	{/if}

	<!-- Title first — every card starts at the same y regardless of labels/badges. -->
	<p class="line-clamp-2 text-sm leading-snug text-[var(--text)]">{ticket.title}</p>

	{#if ticket.blocked || shownLabels.length}
		<div class="flex flex-wrap items-center gap-1">
			{#if ticket.blocked}
				<span
					class="flex items-center gap-0.5 rounded-[3px] border border-[color-mix(in_srgb,var(--amber)_30%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--amber)]"
					style="background:color-mix(in srgb, var(--amber) 12%, transparent)"
					title="Blocked by another ticket"
				>
					<Ban size={10} /> Blocked
				</span>
			{/if}
			{#each shownLabels as label (label.id)}
				<span
					class="rounded-[3px] px-1.5 py-0.5 text-[10px] font-medium"
					style={`background:color-mix(in oklab, ${label.color} 14%, transparent);color:${label.color}`}
				>
					{label.name}
				</span>
			{/each}
			{#if extraLabels > 0}<span class="data-mono text-[var(--faint)]">+{extraLabels}</span>{/if}
		</div>
	{/if}

	<div class="data-mono flex items-center gap-2 text-[var(--dim)]">
		<span>#{ticket.number}</span>
		{#if ticket.priority !== 'none'}<span>{PRIORITY_SHORT[ticket.priority]}</span>{/if}
		{#if due}
			<span
				class={cn(
					'flex items-center gap-0.5',
					due.overdue ? 'text-[#f85149]' : due.soon ? 'text-[var(--amber)]' : ''
				)}
				title={due.overdue ? 'Overdue' : `Due ${due.label}`}
			>
				<Clock size={11} /> {due.label}
			</span>
		{/if}
		{#if ticket.githubIssueNumber}
			<span class="flex items-center gap-0.5" title="Linked GitHub issue"><Link2 size={11} /> {ticket.githubIssueNumber}</span>
		{/if}
		{#if ticket.githubPrNumber}
			{@const merged = ticket.githubPrState === 'merged'}
			{@const ci = ciMeta(ticket.githubCiStatus)}
			<span
				class={cn(
					'flex items-center gap-0.5',
					merged ? 'text-[#a371f7]' : ticket.githubPrState === 'closed' ? 'text-[#f85149]' : 'text-[var(--green)]'
				)}
				title={`Pull request #${ticket.githubPrNumber}${ticket.githubPrState ? ' — ' + ticket.githubPrState : ''}${ci ? ' · ' + ci.label : ''}`}
			>
				{#if merged}<GitMerge size={11} />{:else}<GitPullRequest size={11} />{/if} {ticket.githubPrNumber}
				{#if ci}<span class={`h-1.5 w-1.5 rounded-full ${ci.dotClass}`}></span>{/if}
			</span>
		{/if}
		{#if ticket.hasDescription}<AlignLeft size={12} title="Has description" />{/if}
		{#if ticket.relations > 0}
			<span class="flex items-center gap-0.5" title={`${ticket.relations} linked ticket${ticket.relations === 1 ? '' : 's'}`}>
				<Waypoints size={11} /> {ticket.relations}
			</span>
		{/if}
		<span class="flex-1"></span>
		{#if ticket.votes > 0}<span class="flex items-center gap-0.5"><ChevronUp size={12} /> {ticket.votes}</span>{/if}
		{#if ticket.comments > 0}<span class="flex items-center gap-0.5"><MessageSquare size={11} /> {ticket.comments}</span>{/if}
		{#if assignees.length}<AvatarStack users={assignees} size={16} max={3} />{/if}
	</div>
</div>
