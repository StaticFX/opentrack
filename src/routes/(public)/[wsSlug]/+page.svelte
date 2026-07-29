<script lang="ts">
	import { CircleCheckBig, CircleDot, Hammer, Lightbulb, MessageSquare, Tag } from '@lucide/svelte';
	import EmptyState from '$lib/components/public/EmptyState.svelte';
	import ProjectRow from '$lib/components/public/ProjectRow.svelte';
	import PublicMeta from '$lib/components/public/PublicMeta.svelte';
	import { ago } from '$lib/time';

	let { data } = $props();
	const ws = $derived(data.workspace);
	// Fall back to sensible defaults when the workspace hasn't customized its hero.
	const headline = $derived(ws.publicHeadline?.trim() || ws.name);
	const tagline = $derived(
		ws.publicTagline?.trim() ||
			ws.description ||
			"Follow what's being worked on, upvote what matters to you, and suggest what comes next."
	);

	type Activity = (typeof data.activity)[number];
	function actLine(a: Activity): { text: string; href: string; icon: typeof CircleDot } {
		const who = a.actorName ?? 'Someone';
		switch (a.type) {
			case 'ticket.created':
				return { text: `${who} opened #${a.ticketNumber} in ${a.projectName}`, href: `${a.base}/t/${a.ticketNumber}`, icon: CircleDot };
			case 'ticket.closed':
				return { text: `${who} shipped #${a.ticketNumber} in ${a.projectName}`, href: `${a.base}/t/${a.ticketNumber}`, icon: CircleCheckBig };
			case 'ticket.commented':
				return { text: `${who} commented on #${a.ticketNumber}`, href: `${a.base}/t/${a.ticketNumber}`, icon: MessageSquare };
			case 'suggestion.created':
				return { text: `${who} pitched “${a.suggestionTitle}”`, href: `${a.base}/suggestions/${a.suggestionId}`, icon: Lightbulb };
			case 'suggestion.status':
				return { text: `“${a.suggestionTitle}” got a decision`, href: `${a.base}/suggestions/${a.suggestionId}`, icon: Hammer };
			case 'suggestion.commented':
				return { text: `${who} commented on “${a.suggestionTitle}”`, href: `${a.base}/suggestions/${a.suggestionId}`, icon: MessageSquare };
			case 'release.published':
				return { text: `${a.projectName} ${a.releaseVersion} is out 🎉`, href: `${a.base}/releases`, icon: Tag };
			default:
				return { text: `${who} did something in ${a.projectName}`, href: a.base, icon: CircleDot };
		}
	}
</script>

<PublicMeta
	title={ws.name}
	description={`${tagline} — ${data.totals.projects} ${data.totals.projects === 1 ? 'project' : 'projects'}, ${data.totals.open} open, ${data.totals.shipped} shipped.`}
/>

<main class="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-14">
	<!-- Hero: type on the ground, no card. -->
	<section class="flex max-w-3xl items-start gap-4">
		{#if ws.avatarUrl}
			<img src={ws.avatarUrl} alt="" class="mt-1 size-13 shrink-0 rounded-sm object-cover" />
		{:else}
			<span
				class="mono-display mt-1 grid size-13 shrink-0 place-items-center rounded-sm text-2xl text-[var(--ground)]"
				style={`background:${ws.color || 'var(--accent)'}`}
			>
				{#if ws.icon}{ws.icon}{:else}{ws.name.slice(0, 1).toUpperCase()}{/if}
			</span>
		{/if}
		<div class="min-w-0">
			<h1 class="mono-display text-3xl leading-[1.05] tracking-tight text-[var(--text)] sm:text-5xl">{headline}</h1>
			<p class="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--dim)] sm:text-base">{tagline}</p>
			{#if data.totals.projects > 0}
				<p class="mt-6 border-t border-[var(--rule)] pt-4 text-[12px] tracking-tight text-[var(--faint)]">
					<span class="tabular-nums text-[var(--dim)]">{data.totals.projects}</span>
					{data.totals.projects === 1 ? 'project' : 'projects'} ·
					<span class="tabular-nums text-[var(--dim)]">{data.totals.open}</span> open ·
					<span class="tabular-nums" style="color:var(--green)">{data.totals.shipped}</span> shipped
				</p>
			{/if}
		</div>
	</section>

	<!-- Mobile-only activity ticker: keeps social proof from landing below the
	     fold when the aside stacks under the project list. -->
	{#if data.activity.length}
		<div class="mt-6 -mx-4 flex gap-2 overflow-x-auto border-t border-[var(--rule)] px-4 pt-4 pb-1 sm:-mx-6 sm:px-6 lg:hidden" style="scrollbar-width: none">
			{#each data.activity.slice(0, 3) as a (a.id)}
				{@const line = actLine(a)}
				<a
					href={line.href}
					class="mono-focus flex shrink-0 items-center gap-1.5 border border-[var(--rule)] px-2.5 py-1.5 text-[11px] tracking-tight text-[var(--dim)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
				>
					<line.icon size={12} class="shrink-0 text-[var(--faint)]" />
					<span class="max-w-52 truncate">{line.text}</span>
				</a>
			{/each}
		</div>
	{/if}

	{#if data.projects.length}
		<div class="mt-12 grid gap-x-10 gap-y-10 lg:grid-cols-12">
			<div class="lg:col-span-8">
				<p class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">01 // Projects</p>
				<div class="mt-4 border-t border-[var(--rule)]">
					{#each data.projects as p, i (p.slug)}
						<div class="ot-rise" style={`--rise-i:${i}`}>
							<ProjectRow
								href={`/${ws.slug}/${p.slug}`}
								name={p.name}
								description={p.description}
								icon={p.icon}
								color={p.color}
								stats={p.stats}
							/>
						</div>
					{/each}
				</div>
			</div>

			{#if data.activity.length}
				<aside class="hidden lg:col-span-4 lg:block lg:sticky lg:top-20 lg:self-start">
					<p class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">02 // Fresh off the wall</p>
					<ol class="mt-4">
						{#each data.activity as a (a.id)}
							{@const line = actLine(a)}
							{@const Icon = line.icon}
							<li class="border-b border-[var(--rule)]">
								<a href={line.href} class="mono-focus group flex items-start gap-2.5 py-2.5 transition-colors">
									{#if a.actorAvatar}
										<img src={a.actorAvatar} alt="" class="mt-0.5 size-5 shrink-0 rounded-full" />
									{:else}
										<span class="mt-0.5 grid size-5 shrink-0 place-items-center border border-[var(--rule)] text-[var(--faint)]"><Icon size={11} /></span>
									{/if}
									<span class="min-w-0 flex-1 text-[13px] leading-5 text-[var(--dim)] group-hover:text-[var(--text)]">{line.text}</span>
									<span class="shrink-0 text-[10px] leading-5 tabular-nums text-[var(--faint)]">{ago(a.createdAt)}</span>
								</a>
							</li>
						{/each}
					</ol>
				</aside>
			{/if}
		</div>
	{:else}
		<div class="mt-12 border-t border-[var(--rule)] pt-10">
			<EmptyState icon={Hammer} title="Nothing public here yet" body="This workspace hasn't put anything on the wall so far." />
		</div>
	{/if}
</main>
