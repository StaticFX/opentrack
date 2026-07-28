<script lang="ts">
	import { CalendarPlus, CircleCheckBig, GitMerge, GitPullRequest, Link2, Milestone, Timer, Users } from '@lucide/svelte';
	import { ciMeta } from '$lib/github-ci';
	import { ago } from '$lib/time';

	// Wrapping chip row of everything the data already knows about a ticket.
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

	const chip =
		'flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1 font-mono text-[11px] text-neutral-500 dark:bg-white/[0.06] dark:text-neutral-400';
	const ci = $derived(ciMeta(githubCiStatus));
</script>

<div class="flex flex-wrap items-center gap-1.5">
	<span class={chip} title={new Date(createdAt).toLocaleString()}>
		<CalendarPlus size={12} /> opened {ago(createdAt)}{#if authorName}&nbsp;by {authorName}{/if}
	</span>
	{#if closedAt}
		<span class="{chip} !text-green-600 dark:!text-green-400" title={new Date(closedAt).toLocaleString()}>
			<CircleCheckBig size={12} /> closed {ago(closedAt)}
		</span>
	{:else if column}
		<span class={chip}><Timer size={12} /> currently in: <strong class="font-semibold text-neutral-700 dark:text-neutral-200">{column.name}</strong></span>
	{/if}
	{#if milestone}
		<span class="{chip} {milestone.state === 'closed' ? 'opacity-60' : ''}"><Milestone size={12} /> {milestone.title}</span>
	{/if}
	{#if assignees.length}
		<span class={chip}>
			<Users size={12} />
			<span class="flex -space-x-1">
				{#each assignees.slice(0, 3) as a (a.displayName)}
					{#if a.avatarUrl}
						<img src={a.avatarUrl} alt={a.displayName} title={a.displayName} class="size-4 rounded-full ring-1 ring-white dark:ring-neutral-800" />
					{:else}
						<span class="grid size-4 place-items-center rounded-full bg-neutral-300 text-[8px] font-semibold text-neutral-700 ring-1 ring-white dark:bg-neutral-600 dark:text-neutral-100 dark:ring-neutral-800" title={a.displayName}>{a.displayName.slice(0, 1).toUpperCase()}</span>
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
			class="{chip} transition-colors hover:bg-black/[0.08] dark:hover:bg-white/[0.1] {merged ? '!text-violet-500' : githubPrState === 'closed' ? '!text-red-400' : '!text-green-600 dark:!text-green-400'}"
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
			class="{chip} transition-colors hover:bg-black/[0.08] dark:hover:bg-white/[0.1]"
		>
			<Link2 size={12} /> issue #{githubIssueNumber}
		</a>
	{/if}
</div>

{#if relations.length}
	<ul class="mt-2.5 space-y-1">
		{#each relations as r (r.id)}
			<li>
				<a href={`${base}/t/${r.targetNumber}`} class="group flex items-center gap-1.5 text-xs text-neutral-500 hover:text-[var(--accent-fg)] dark:text-neutral-400">
					<Link2 size={11} class="shrink-0" />
					{r.label}
					<span class="font-mono">#{r.targetNumber}</span>
					<span class="truncate group-hover:underline">— {r.targetTitle}</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
