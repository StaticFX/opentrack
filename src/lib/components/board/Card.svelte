<script lang="ts">
	import { MessageSquare, ChevronUp, Link2, AlignLeft, Ban, GitPullRequest, GitMerge, Milestone } from '@lucide/svelte';
	import type { TicketCard } from '$lib/board';
	import { PRIORITY_META } from '$lib/priority';

	type Props = { ticket: TicketCard; onopen: (id: string) => void };
	let { ticket, onopen }: Props = $props();
</script>

<div
	role="button"
	tabindex="0"
	onclick={() => onopen(ticket.id)}
	onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onopen(ticket.id)}
	class="cursor-pointer rounded-lg border border-neutral-200 bg-white p-2.5 shadow-sm transition hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
>
	{#if ticket.labels.length || ticket.blocked}
		<div class="mb-1.5 flex flex-wrap items-center gap-1">
			{#if ticket.blocked}
				<span
					class="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
					style="background:rgb(245 158 11 / 0.15)"
					title="Blocked by another ticket"
				>
					<Ban size={10} /> Blocked
				</span>
			{/if}
			{#each ticket.labels as label (label.id)}
				<span
					class="rounded px-1.5 py-0.5 text-[10px] font-medium"
					style={`background:${label.color}22; color:${label.color}`}
				>
					{label.name}
				</span>
			{/each}
		</div>
	{/if}

	<p class="text-sm leading-snug text-neutral-800 dark:text-neutral-100">{ticket.title}</p>

	{#if ticket.milestone}
		<div class="mt-1.5">
			<span
				class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-300"
				style="background:rgb(139 92 246 / 0.14)"
				title={`Milestone: ${ticket.milestone.title}${ticket.milestone.state === 'closed' ? ' (closed)' : ''}`}
			>
				<Milestone size={10} />
				<span class="max-w-[140px] truncate">{ticket.milestone.title}</span>
			</span>
		</div>
	{/if}

	<div class="mt-2 flex items-center gap-2 text-[11px] text-neutral-400">
		{#if ticket.priority !== 'none'}
			<span
				class="size-2 rounded-full"
				style={`background:${PRIORITY_META[ticket.priority].color}`}
				title={PRIORITY_META[ticket.priority].label}
			></span>
		{/if}
		<span class="font-mono">#{ticket.number}</span>
		{#if ticket.githubIssueNumber}
			<span class="flex items-center gap-0.5" title="Linked GitHub issue">
				<Link2 size={11} /> {ticket.githubIssueNumber}
			</span>
		{/if}
		{#if ticket.githubPrNumber}
			{@const merged = ticket.githubPrState === 'merged'}
			<span
				class="flex items-center gap-0.5 {merged ? 'text-violet-500' : ticket.githubPrState === 'closed' ? 'text-red-400' : 'text-green-500'}"
				title={`Pull request #${ticket.githubPrNumber}${ticket.githubPrState ? ' — ' + ticket.githubPrState : ''}`}
			>
				{#if merged}<GitMerge size={11} />{:else}<GitPullRequest size={11} />{/if} {ticket.githubPrNumber}
			</span>
		{/if}
		{#if ticket.hasDescription}
			<AlignLeft size={12} title="Has description" />
		{/if}
		{#if ticket.relations > 0}
			<span class="flex items-center gap-0.5" title={`${ticket.relations} linked ticket${ticket.relations === 1 ? '' : 's'}`}>
				<Link2 size={11} /> {ticket.relations}
			</span>
		{/if}
		<span class="flex-1"></span>
		{#if ticket.votes > 0}
			<span class="flex items-center gap-0.5"><ChevronUp size={12} /> {ticket.votes}</span>
		{/if}
		{#if ticket.comments > 0}
			<span class="flex items-center gap-0.5"><MessageSquare size={11} /> {ticket.comments}</span>
		{/if}
		{#if ticket.assignees.length}
			<div class="flex -space-x-1.5">
				{#each ticket.assignees.slice(0, 3) as a (a.userId ?? a.githubLogin)}
					{@const label = a.githubLogin ? `${a.displayName} (@${a.githubLogin})` : a.displayName}
					{#if a.avatarUrl}
						<img src={a.avatarUrl} alt={a.displayName} title={label} class="size-4 rounded-full ring-1 ring-white dark:ring-neutral-900" />
					{:else}
						<span
							class="grid size-4 place-items-center rounded-full bg-neutral-300 text-[8px] font-semibold text-neutral-700 ring-1 ring-white dark:bg-neutral-600 dark:text-neutral-100 dark:ring-neutral-900"
							title={label}
						>{a.displayName.slice(0, 1).toUpperCase()}</span>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>
