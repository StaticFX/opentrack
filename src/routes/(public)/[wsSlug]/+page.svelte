<script lang="ts">
	import { CircleCheckBig, CircleDot, Hammer, Lightbulb, MessageSquare, Tag } from '@lucide/svelte';
	import EmptyState from '$lib/components/public/EmptyState.svelte';
	import ProjectRow from '$lib/components/public/ProjectRow.svelte';
	import PublicMeta from '$lib/components/public/PublicMeta.svelte';
	import BlurText from '$lib/components/vendor/BlurText.svelte';
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

<main class="mx-auto max-w-6xl px-4 pt-12 pb-4 sm:px-6 sm:pt-14">
	<!-- Hero -->
	<section class="flex max-w-3xl items-start gap-4">
		{#if ws.avatarUrl}
			<img src={ws.avatarUrl} alt="" class="mt-1 size-13 shrink-0 rounded-2xl object-cover shadow-lg" />
		{:else}
			<span
				class="mt-1 grid size-13 shrink-0 place-items-center rounded-2xl text-2xl font-bold text-white shadow-lg"
				style={`background:${ws.color || 'var(--color-brand-600)'}`}
			>
				{#if ws.icon}{ws.icon}{:else}{ws.name.slice(0, 1).toUpperCase()}{/if}
			</span>
		{/if}
		<div class="min-w-0">
			<h1 class="type-poster text-3xl leading-[1.05] sm:text-5xl"><BlurText text={headline} animateBy="words" direction="top" delay={70} /></h1>
			<p class="mt-3 max-w-xl text-lg text-neutral-500 dark:text-neutral-400">{tagline}</p>
			{#if data.totals.projects > 0}
				<p class="mt-4 font-mono text-[12px] text-neutral-400 dark:text-neutral-500">
					{data.totals.projects} {data.totals.projects === 1 ? 'project' : 'projects'}
					· <span class="font-semibold text-neutral-500 dark:text-neutral-300">{data.totals.open}</span> open
					· <span class="font-semibold text-green-600 dark:text-green-400">{data.totals.shipped}</span> shipped
				</p>
			{/if}
		</div>
	</section>

	{#if data.projects.length}
		<div class="mt-10 grid gap-x-10 gap-y-10 lg:grid-cols-12">
			<div class="space-y-2.5 lg:col-span-8">
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

			{#if data.activity.length}
				<aside class="lg:col-span-4">
					<h2 class="pub-label">Fresh off the wall</h2>
					<ol class="mt-3 space-y-0.5">
						{#each data.activity as a (a.id)}
							{@const line = actLine(a)}
							{@const Icon = line.icon}
							<li>
								<a href={line.href} class="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
									{#if a.actorAvatar}
										<img src={a.actorAvatar} alt="" class="mt-0.5 size-5 shrink-0 rounded-full" />
									{:else}
										<span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-black/5 text-neutral-400 dark:bg-white/10"><Icon size={11} /></span>
									{/if}
									<span class="min-w-0 flex-1 text-[13px] leading-5 text-neutral-600 group-hover:text-neutral-900 dark:text-neutral-300 dark:group-hover:text-white">{line.text}</span>
									<span class="shrink-0 font-mono text-[10px] leading-5 text-neutral-400">{ago(a.createdAt)}</span>
								</a>
							</li>
						{/each}
					</ol>
				</aside>
			{/if}
		</div>
	{:else}
		<div class="pub-card mt-10 rounded-3xl">
			<EmptyState icon={Hammer} title="Nothing public here yet" body="This workspace hasn't put anything on the wall so far." />
		</div>
	{/if}
</main>
