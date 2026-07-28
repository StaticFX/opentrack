<script lang="ts">
	import { MessageSquare, ChevronUp, Ban, GitMerge, GitPullRequest, Milestone } from '@lucide/svelte';
	import type { TicketCard } from '$lib/board';

	type Props = {
		ticket: TicketCard;
		href: string;
		/** Column colour painted as the card's left edge. */
		edge?: string;
		/** One-shot accent ring (a vote just landed via SSE). */
		flash?: boolean;
	};
	let { ticket, href, edge, flash = false }: Props = $props();
</script>

<a
	{href}
	class="group block rounded-xl border border-black/5 bg-white p-3.5 shadow-[0_1px_2px_rgb(20_22_28/0.04),0_6px_16px_-8px_rgb(20_22_28/0.14)] transition duration-150 hover:-translate-y-px hover:shadow-[0_10px_30px_-12px_rgb(20_22_28/0.3)] active:scale-[0.98] dark:border-white/5 dark:bg-neutral-800 dark:shadow-[0_1px_2px_rgb(0_0_0/0.25)] {flash ? 'ot-flash' : ''}"
	style={`view-transition-name: t-${ticket.number};${edge ? `border-left:3px solid ${edge}` : ''}`}
>
	{#if ticket.labels.length || ticket.blocked}
		<div class="mb-1.5 flex flex-wrap items-center gap-1">
			{#if ticket.blocked}
				<span class="flex items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400" title="Blocked by another ticket">
					<Ban size={10} /> Blocked
				</span>
			{/if}
			{#each ticket.labels as label (label.id)}
				<span
					class="rounded-full px-2 py-0.5 text-[10px] font-medium"
					style={`background:color-mix(in oklab, ${label.color} 13%, transparent); color:${label.color}`}
				>
					{label.name}
				</span>
			{/each}
		</div>
	{/if}

	<p class="text-sm leading-snug font-medium text-neutral-800 group-hover:text-neutral-950 dark:text-neutral-100 dark:group-hover:text-white">
		{ticket.title}
	</p>

	<div class="mt-2.5 flex items-center gap-2.5 font-mono text-[11px] text-neutral-400">
		<span>#{ticket.number}</span>
		{#if ticket.milestone}
			<span class="flex max-w-24 items-center gap-0.5" title={`Milestone: ${ticket.milestone.title}`}>
				<Milestone size={11} class="shrink-0" /><span class="truncate">{ticket.milestone.title}</span>
			</span>
		{/if}
		{#if ticket.githubPrNumber}
			{@const merged = ticket.githubPrState === 'merged'}
			<span
				class="flex items-center gap-0.5 {merged ? 'text-violet-500' : ticket.githubPrState === 'closed' ? 'text-red-400' : 'text-green-500'}"
				title={`Pull request #${ticket.githubPrNumber}${ticket.githubPrState ? ' — ' + ticket.githubPrState : ''}`}
			>
				{#if merged}<GitMerge size={11} />{:else}<GitPullRequest size={11} />{/if}{ticket.githubPrNumber}
			</span>
		{/if}
		<span class="flex-1"></span>
		{#if ticket.votes > 0}
			<span class="flex items-center gap-0.5 font-semibold text-[var(--accent-fg)]"><ChevronUp size={13} /> {ticket.votes}</span>
		{/if}
		{#if ticket.comments > 0}
			<span class="flex items-center gap-1"><MessageSquare size={11} /> {ticket.comments}</span>
		{/if}
		{#if ticket.assignees.length}
			<span class="flex -space-x-1.5">
				{#each ticket.assignees.slice(0, 3) as a (a.userId ?? a.githubLogin)}
					{#if a.avatarUrl}
						<img src={a.avatarUrl} alt={a.displayName} title={a.displayName} class="size-4.5 rounded-full ring-2 ring-white dark:ring-neutral-800" />
					{:else}
						<span
							class="grid size-4.5 place-items-center rounded-full bg-neutral-300 text-[8px] font-semibold text-neutral-700 ring-2 ring-white dark:bg-neutral-600 dark:text-neutral-100 dark:ring-neutral-800"
							title={a.displayName}
						>{a.displayName.slice(0, 1).toUpperCase()}</span>
					{/if}
				{/each}
			</span>
		{/if}
	</div>
</a>
