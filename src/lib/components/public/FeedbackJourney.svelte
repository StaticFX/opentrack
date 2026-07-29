<script lang="ts">
	import { Check, CircleDashed, Copy, GitMerge, GitPullRequest, Hammer, PartyPopper, X } from '@lucide/svelte';
	import { ago } from '$lib/time';

	// The literal track a piece of feedback travels:
	// Posted → Under review → In the works → Shipped.
	export type JourneyStage =
		| 'open'
		| 'accepted'
		| 'declined'
		| 'merged'
		| 'queued'
		| 'building'
		| 'shipped'
		| 'closed';

	export interface JourneyTicket {
		number: number;
		url: string;
		columnName: string | null;
		assignees: Array<{ displayName: string; avatarUrl: string | null }>;
		pr: { number: number; state: string; url: string } | null;
		release: { version: string; url: string } | null;
	}

	type Props = {
		stage: JourneyStage;
		postedAt: Date | string;
		votes: number;
		kind: 'suggestion' | 'bug';
		duplicateOf?: { id: string; title: string; url: string } | null;
		/** Linked ticket details — null when it exists but isn't publicly visible. */
		ticket?: JourneyTicket | null;
	};
	let { stage, postedAt, votes, kind, duplicateOf = null, ticket = null }: Props = $props();

	type StepState = 'done' | 'active' | 'todo' | 'declined' | 'merged';
	interface Step {
		label: string;
		state: StepState;
		sub?: string;
		href?: string | null;
	}

	const voteLine = $derived(
		votes === 0
			? 'votes help this get noticed'
			: `${votes} ${votes === 1 ? 'vote' : 'votes'} so far — votes help this get noticed`
	);

	const steps = $derived.by<Step[]>(() => {
		const posted: Step = { label: 'Posted', state: 'done', sub: ago(postedAt) };

		if (stage === 'declined') {
			return [
				posted,
				{ label: 'Not planned', state: 'declined', sub: 'not every idea fits — thanks for helping us think it through' }
			];
		}
		if (stage === 'merged') {
			return [
				posted,
				{
					label: 'Merged',
					state: 'merged',
					sub: duplicateOf ? `into “${duplicateOf.title}” — your votes moved with it` : 'into another thread — your votes moved with it',
					href: duplicateOf?.url ?? null
				}
			];
		}

		const review: Step =
			stage === 'open'
				? { label: 'Under review', state: 'active', sub: `waiting for review · ${voteLine}` }
				: { label: 'Accepted', state: 'done', sub: ticket ? `now ticket #${ticket.number}` : undefined, href: ticket?.url ?? null };

		const worksSub = () => {
			if (stage === 'building') {
				const who = ticket?.assignees?.[0]?.displayName;
				return who ? `being built right now by ${who}` : 'being built right now';
			}
			if (stage === 'queued') return ticket?.columnName ? `on the board — ${ticket.columnName.toLowerCase()}` : 'on the board, queued';
			if (stage === 'accepted') return 'not scheduled yet';
			return undefined;
		};
		const works: Step =
			stage === 'building' || stage === 'queued'
				? { label: 'In the works', state: 'active', sub: worksSub(), href: ticket?.url ?? null }
				: stage === 'shipped' || stage === 'closed'
					? { label: 'In the works', state: 'done', href: ticket?.url ?? null }
					: { label: 'In the works', state: 'todo', sub: worksSub() };

		const shippedStep: Step =
			stage === 'shipped'
				? {
						label: 'Shipped',
						state: 'done',
						sub: ticket?.release ? `in ${ticket.release.version} 🎉` : '🎉',
						href: ticket?.release?.url ?? ticket?.url ?? null
					}
				: stage === 'closed'
					? { label: 'Closed', state: 'declined', sub: 'not landing this time' }
					: { label: 'Shipped', state: 'todo' };

		return [posted, review, works, shippedStep];
	});

	const stepIcon = (s: Step, i: number) => {
		if (s.state === 'declined') return X;
		if (s.state === 'merged') return duplicateOf ? Copy : GitMerge;
		if (s.state === 'done') return i === 3 ? PartyPopper : Check;
		if (s.state === 'active') return i === 2 ? Hammer : CircleDashed;
		return CircleDashed;
	};
	const terminal = $derived(steps.length === 2);
</script>

<ol class="flex flex-col gap-0 sm:flex-row sm:items-start sm:gap-0" aria-label="Where this feedback is on its journey">
	{#each steps as step, i (i)}
		{@const Icon = stepIcon(step, i)}
		{@const last = i === steps.length - 1}
		<li
			class="relative flex min-w-0 gap-3 sm:flex-1 sm:flex-col sm:gap-0"
			aria-current={step.state === 'active' ? 'step' : undefined}
		>
			<!-- node + connector -->
			<div class="flex flex-col items-center sm:w-full sm:flex-row">
				<span
					class="relative z-10 grid size-7 shrink-0 place-items-center rounded-full border-2 text-[var(--ground)]
						{step.state === 'done' ? (i === 3 ? 'border-transparent bg-[var(--green)]' : 'border-transparent bg-[var(--accent)]') : ''}
						{step.state === 'active' ? 'border-[var(--amber)] bg-[var(--amber)]' : ''}
						{step.state === 'declined' ? 'border-transparent bg-[var(--faint)]' : ''}
						{step.state === 'merged' ? 'border-transparent bg-[var(--dim)]' : ''}
						{step.state === 'todo' ? 'border-[var(--rule)] bg-transparent !text-[var(--faint)]' : ''}"
				>
					{#if step.state === 'active'}
						<span class="absolute inset-0 rounded-full bg-[var(--amber)] ot-breathe" aria-hidden="true"></span>
					{/if}
					<Icon size={13} class="relative" />
				</span>
				{#if !last}
					<span class="ml-3 h-8 w-0.5 rounded bg-[var(--rule)] sm:mx-2 sm:h-0.5 sm:w-auto sm:flex-1" aria-hidden="true">
						{#if step.state === 'done' || step.state === 'active'}
							<span
								class="ot-grow-x block h-full w-full rounded"
								style={`background:${steps[i + 1].state === 'todo' ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : 'var(--accent)'}; animation-delay:${i * 80}ms`}
							></span>
						{/if}
					</span>
				{/if}
			</div>
			<!-- label -->
			<div class="min-w-0 pb-4 sm:mt-2 sm:pr-3 sm:pb-0 {terminal && last ? 'sm:flex-1' : ''}">
				<p class="text-[13px] leading-7 font-semibold sm:leading-tight text-[var(--text)]
					{step.state === 'active' ? '!text-[var(--amber)]' : ''}
					{step.state === 'declined' ? '!text-[var(--faint)]' : ''}
					{step.state === 'merged' ? '!text-[var(--dim)]' : ''}
					{step.state === 'todo' ? '!text-[var(--faint)]' : ''}"
				>
					{#if step.href}
						<a href={step.href} class="hover:underline">{step.label}</a>
					{:else}
						{step.label}
					{/if}
				</p>
				{#if step.sub}
					<p class="mt-0.5 text-[10px] leading-snug text-[var(--faint)]">{step.sub}</p>
				{/if}
				{#if i === 2 && (stage === 'building' || stage === 'queued') && ticket}
					<div class="mt-1 flex items-center gap-1.5">
						{#each ticket.assignees.slice(0, 3) as a (a.displayName)}
							{#if a.avatarUrl}
								<img src={a.avatarUrl} alt={a.displayName} title={a.displayName} class="size-4.5 rounded-full ring-1 ring-[var(--ground)]" />
							{/if}
						{/each}
						{#if ticket.pr}
							<a
								href={ticket.pr.url}
								target="_blank"
								rel="noreferrer"
								class="flex items-center gap-0.5 text-[10px] tabular-nums {ticket.pr.state === 'merged' ? 'text-[var(--green)]' : 'text-[var(--dim)]'} transition-colors hover:text-[var(--accent)]"
							>
								{#if ticket.pr.state === 'merged'}<GitMerge size={10} />{:else}<GitPullRequest size={10} />{/if}
								PR #{ticket.pr.number}
							</a>
						{/if}
					</div>
				{/if}
			</div>
		</li>
	{/each}
</ol>
