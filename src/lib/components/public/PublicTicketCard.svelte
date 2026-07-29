<script lang="ts">
	import { MessageSquare, GitMerge, GitPullRequest, Milestone } from '@lucide/svelte';
	import type { TicketCard } from '$lib/board';

	type Props = {
		ticket: TicketCard;
		href: string;
		/** Column colour painted as the row's left edge on hover / flash. */
		edge?: string;
		/** One-shot accent ring (a vote just landed via SSE). */
		flash?: boolean;
	};
	let { ticket, href, edge, flash = false }: Props = $props();

	// PR state → the one restrained semantic colour: shipped/merged reads green.
	const prColor = $derived(
		ticket.githubPrState === 'merged'
			? 'var(--green)'
			: ticket.githubPrState === 'closed'
				? 'var(--faint)'
				: 'var(--dim)'
	);
</script>

<a
	{href}
	class="ot-ticket group block border-l-2 border-transparent px-3 py-2.5 transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_9%,transparent)] {flash ? 'ot-flash' : ''}"
	style={`view-transition-name: t-${ticket.number};${edge ? `--edge:${edge}` : ''}`}
>
	<span class="flex items-baseline gap-2 text-[13px]">
		<span class="shrink-0 tabular-nums text-[var(--faint)]">#{ticket.number}</span>
		<span class="min-w-0 flex-1 truncate text-[var(--text)] transition-colors group-hover:text-[var(--accent)]">
			{ticket.title}
		</span>
		{#if ticket.blocked}
			<span class="shrink-0 text-[10px] tracking-wide text-[var(--amber)] uppercase" title="Blocked by another ticket">blocked</span>
		{/if}
		{#if ticket.votes > 0}
			<span class="shrink-0 text-[11px] tabular-nums text-[var(--dim)]">▲{ticket.votes}</span>
		{/if}
	</span>

	{#if ticket.labels.length}
		<span class="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 pl-[4.2ch] text-[10px]">
			{#each ticket.labels as label (label.id)}
				<span style={`color:${label.color}`}>#{label.name}</span>
			{/each}
		</span>
	{/if}

	{#if ticket.milestone || ticket.githubPrNumber || ticket.comments > 0 || ticket.assignees.length}
		<span class="mt-1.5 flex items-center gap-3 pl-[4.2ch] text-[11px] tabular-nums text-[var(--faint)]">
			{#if ticket.milestone}
				<span class="flex max-w-24 items-center gap-1" title={`Milestone: ${ticket.milestone.title}`}>
					<Milestone size={11} class="shrink-0" /><span class="truncate">{ticket.milestone.title}</span>
				</span>
			{/if}
			{#if ticket.githubPrNumber}
				{@const merged = ticket.githubPrState === 'merged'}
				<span
					class="flex items-center gap-1"
					style={`color:${prColor}`}
					title={`Pull request #${ticket.githubPrNumber}${ticket.githubPrState ? ' — ' + ticket.githubPrState : ''}`}
				>
					{#if merged}<GitMerge size={11} />{:else}<GitPullRequest size={11} />{/if}{ticket.githubPrNumber}
				</span>
			{/if}
			{#if ticket.comments > 0}
				<span class="flex items-center gap-1"><MessageSquare size={11} /> {ticket.comments}</span>
			{/if}
			{#if ticket.assignees.length}
				<span class="ml-auto flex -space-x-1.5">
					{#each ticket.assignees.slice(0, 3) as a (a.userId ?? a.githubLogin)}
						{#if a.avatarUrl}
							<img src={a.avatarUrl} alt={a.displayName} title={a.displayName} class="size-4.5 rounded-full ring-1 ring-[var(--ground)]" />
						{:else}
							<span
								class="grid size-4.5 place-items-center rounded-full bg-[var(--raised)] text-[8px] font-semibold text-[var(--dim)] ring-1 ring-[var(--ground)]"
								title={a.displayName}
							>{a.displayName.slice(0, 1).toUpperCase()}</span>
						{/if}
					{/each}
				</span>
			{/if}
		</span>
	{/if}
</a>

<style>
	.ot-ticket:hover {
		border-left-color: var(--edge);
	}
</style>
