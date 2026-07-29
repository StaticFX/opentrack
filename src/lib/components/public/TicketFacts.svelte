<script lang="ts">
	import { CalendarPlus, CircleCheckBig, GitMerge, GitPullRequest, Link2, Milestone, Timer, Users } from '@lucide/svelte';
	import { ciMeta } from '$lib/github-ci';
	import { ago } from '$lib/time';

	// A mono fact row: everything the data already knows about a ticket, as inline
	// monospace facts separated by space — no filled chips, no card.
	type Assignee = { displayName: string; avatarUrl: string | null };
	type Relation = { id: string; label: string; targetNumber: number; targetTitle: string };
	type Props = {
		createdAt: Date | string;
		closedAt: Date | string | null;
		authorName: string | null;
		column: { name: string; category: string } | null;
		milestone: { title: string; state: string } | null;
		assignees: Assignee[];
		relations: Relation[];
		githubRepo: string | null;
		githubIssueNumber: number | null;
		githubPrNumber: number | null;
		githubPrState: string | null;
		githubCiStatus: string | null;
		base: string;
	};
	let {
		createdAt,
		closedAt,
		authorName,
		column,
		milestone,
		assignees,
		relations,
		githubRepo,
		githubIssueNumber,
		githubPrNumber,
		githubPrState,
		githubCiStatus,
		base
	}: Props = $props();

	const fact = 'flex items-center gap-1.5 text-[12px] tabular-nums text-[var(--dim)]';
	const ci = $derived(ciMeta(githubCiStatus));
</script>

<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
	<span class={fact} title={new Date(createdAt).toLocaleString()}>
		<CalendarPlus size={12} class="text-[var(--faint)]" /> opened {ago(createdAt)}{#if authorName}&nbsp;by {authorName}{/if}
	</span>
	{#if closedAt}
		<span class="{fact} !text-[var(--green)]" title={new Date(closedAt).toLocaleString()}>
			<CircleCheckBig size={12} /> closed {ago(closedAt)}
		</span>
	{:else if column}
		<span class="{fact} !text-[var(--amber)]"><Timer size={12} /> in: <strong class="font-semibold">{column.name}</strong></span>
	{/if}
	{#if milestone}
		<span class="{fact} {milestone.state === 'closed' ? 'opacity-60' : ''}"><Milestone size={12} class="text-[var(--faint)]" /> {milestone.title}</span>
	{/if}
	{#if assignees.length}
		<span class={fact}>
			<Users size={12} class="text-[var(--faint)]" />
			<span class="flex -space-x-1">
				{#each assignees.slice(0, 3) as a (a.displayName)}
					{#if a.avatarUrl}
						<img src={a.avatarUrl} alt={a.displayName} title={a.displayName} class="size-4 rounded-full ring-1 ring-[var(--ground)]" />
					{:else}
						<span class="grid size-4 place-items-center rounded-full bg-[var(--raised)] text-[8px] font-semibold text-[var(--dim)] ring-1 ring-[var(--ground)]" title={a.displayName}>{a.displayName.slice(0, 1).toUpperCase()}</span>
					{/if}
				{/each}
			</span>
			{assignees[0].displayName}{assignees.length > 1 ? ` +${assignees.length - 1}` : ''}
		</span>
	{/if}
	{#if githubPrNumber && githubRepo}
		{@const merged = githubPrState === 'merged'}
		<a
			href={`https://github.com/${githubRepo}/pull/${githubPrNumber}`}
			target="_blank"
			rel="noreferrer"
			class="{fact} transition-colors hover:!text-[var(--accent)] {merged ? '!text-[var(--green)]' : githubPrState === 'closed' ? '!text-[var(--faint)]' : '!text-[var(--dim)]'}"
		>
			{#if merged}<GitMerge size={12} />{:else}<GitPullRequest size={12} />{/if}
			PR #{githubPrNumber}{githubPrState ? ` · ${githubPrState}` : ''}
			{#if ci}<span class={`size-1.5 rounded-full ${ci.dotClass}`} title={ci.label}></span>{/if}
		</a>
	{/if}
	{#if githubIssueNumber && githubRepo}
		<a
			href={`https://github.com/${githubRepo}/issues/${githubIssueNumber}`}
			target="_blank"
			rel="noreferrer"
			class="{fact} transition-colors hover:!text-[var(--accent)]"
		>
			<Link2 size={12} class="text-[var(--faint)]" /> issue #{githubIssueNumber}
		</a>
	{/if}
</div>

{#if relations.length}
	<ul class="mt-3 space-y-1">
		{#each relations as r (r.id)}
			<li>
				<a href={`${base}/t/${r.targetNumber}`} class="mono-focus group flex items-center gap-1.5 text-[12px] text-[var(--dim)] transition-colors hover:text-[var(--accent)]">
					<Link2 size={11} class="shrink-0 text-[var(--faint)]" />
					{r.label}
					<span class="tabular-nums text-[var(--faint)]">#{r.targetNumber}</span>
					<span class="truncate">— {r.targetTitle}</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
