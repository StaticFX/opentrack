<script lang="ts">
	import {
		ArrowRight,
		CircleCheckBig,
		CircleDot,
		Hammer,
		Lightbulb,
		MessageSquare,
		Tag
	} from '@lucide/svelte';
	import EmptyState from '$lib/components/public/EmptyState.svelte';
	import ProjectRow from '$lib/components/public/ProjectRow.svelte';
	import PublicMeta from '$lib/components/public/PublicMeta.svelte';
	import DotField from '$lib/components/vendor/DotField.svelte';
	import { ago } from '$lib/time';

	let { data } = $props();

	type Activity = (typeof data.activity)[number];
	function actLine(a: Activity): { text: string; href: string; icon: typeof CircleDot } {
		const who = a.actorName ?? 'Someone';
		switch (a.type) {
			case 'ticket.created':
				return { text: `${who} opened #${a.ticketNumber} in ${a.projectName}`, href: `${a.base}/t/${a.ticketNumber}`, icon: CircleDot };
			case 'ticket.closed':
				return { text: `${who} shipped #${a.ticketNumber} in ${a.projectName}`, href: `${a.base}/t/${a.ticketNumber}`, icon: CircleCheckBig };
			case 'ticket.commented':
				return { text: `${who} commented on #${a.ticketNumber} in ${a.projectName}`, href: `${a.base}/t/${a.ticketNumber}`, icon: MessageSquare };
			case 'suggestion.created':
				return { text: `${who} pitched “${a.suggestionTitle}” to ${a.projectName}`, href: `${a.base}/suggestions/${a.suggestionId}`, icon: Lightbulb };
			case 'suggestion.status':
				return { text: `“${a.suggestionTitle}” got a decision in ${a.projectName}`, href: `${a.base}/suggestions/${a.suggestionId}`, icon: Hammer };
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
	title={`${data.site.name} — ${data.site.headline}`}
	description={data.totals.projects
		? `${data.totals.projects} ${data.totals.projects === 1 ? 'project' : 'projects'} building in the open — ${data.totals.open} open, ${data.totals.shipped} shipped. ${data.site.tagline}`
		: data.site.tagline}
/>

<main class="relative mx-auto max-w-6xl px-4 pt-12 pb-4 sm:px-6 sm:pt-16">
	<!-- Pegboard: an interactive dot field behind the masthead — the workshop
	     wall itself. Fades out before the directory starts. -->
	<div
		class="pointer-events-none absolute inset-x-0 -top-4 h-72 [mask-image:linear-gradient(to_bottom,black_30%,transparent),linear-gradient(to_right,transparent,black_15%,black_85%,transparent)] [mask-composite:intersect]"
		aria-hidden="true"
	>
		<DotField
			dotRadius={2}
			dotSpacing={17}
			cursorRadius={240}
			bulgeStrength={30}
			glowColor="transparent"
			gradientFrom="rgba(234, 88, 12, 0.32)"
			gradientTo="rgba(251, 146, 60, 0.10)"
		/>
	</div>

	<!-- Masthead: the headline is the admin's words, the proof is real numbers. -->
	<section class="relative max-w-3xl">
		<h1 class="type-poster text-4xl leading-[1.05] sm:text-6xl">{data.site.headline}</h1>
		<p class="mt-4 max-w-xl text-lg text-neutral-500 dark:text-neutral-400">{data.site.tagline}</p>
		{#if data.totals.projects > 0}
			<p class="mt-5 flex flex-wrap items-center gap-x-2 font-mono text-[12px] text-neutral-400 dark:text-neutral-500">
				<span class="relative mr-0.5 flex size-2">
					<span class="absolute inline-flex size-full rounded-full bg-brand-500 opacity-60"></span>
					<span class="relative inline-flex size-2 rounded-full bg-brand-500"></span>
				</span>
				{data.totals.projects} {data.totals.projects === 1 ? 'project' : 'projects'}
				<span aria-hidden="true">·</span>
				<span class="font-semibold text-neutral-500 dark:text-neutral-300">{data.totals.open}</span> open
				<span aria-hidden="true">·</span>
				<span class="font-semibold text-green-600 dark:text-green-400">{data.totals.shipped}</span> shipped
				{#if data.totals.lastActivityAt}
					<span aria-hidden="true">·</span> last activity {ago(data.totals.lastActivityAt)}
				{/if}
			</p>
		{/if}
	</section>

	{#if data.items.length}
		<div class="mt-10 grid gap-x-10 gap-y-10 lg:grid-cols-12">
			<!-- The directory IS the hero. -->
			<div class="space-y-10 lg:col-span-8">
				{#each data.items as ws, wi (ws.slug)}
					<section class="ot-rise" style={`--rise-i:${wi * 2}`}>
						<div class="flex items-baseline justify-between gap-3">
							<a href={`/${ws.slug}`} class="group inline-flex items-center gap-2">
								<h2 class="font-display text-xl font-bold tracking-tight">{ws.name}</h2>
								<ArrowRight size={15} class="text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500" />
							</a>
							<span class="shrink-0 font-mono text-[11px] text-neutral-400">{ws.projects.length} {ws.projects.length === 1 ? 'project' : 'projects'}</span>
						</div>
						{#if ws.description}<p class="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{ws.description}</p>{/if}

						<div class="mt-3.5 space-y-2.5">
							{#each ws.projects as p (p.slug)}
								<ProjectRow
									href={`/${ws.slug}/${p.slug}`}
									name={p.name}
									description={p.description}
									icon={p.icon}
									color={p.color}
									stats={p.stats}
								/>
							{/each}
						</div>
					</section>
				{/each}
			</div>

			<!-- The workshop wall: what actually just happened, across everything. -->
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
					<p class="mt-4 px-2 font-mono text-[11px] text-neutral-400 dark:text-neutral-500">
						Anyone can vote. No account needed.
					</p>
				</aside>
			{/if}
		</div>
	{:else}
		<div class="pub-card mt-10 rounded-3xl">
			<EmptyState
				icon={Hammer}
				title="The workshop is warming up"
				body="No public projects yet — when something goes up on the wall, it lands here first."
			/>
		</div>
	{/if}
</main>
