<script lang="ts">
	import { ChevronUp, Lightbulb } from '@lucide/svelte';
	import EmptyState from '$lib/components/public/EmptyState.svelte';
	import PublicMeta from '$lib/components/public/PublicMeta.svelte';
	import StatTile from '$lib/components/public/StatTile.svelte';
	import BlurText from '$lib/components/vendor/BlurText.svelte';
	import { SUGGESTION_STATUS_META } from '$lib/suggestionStatus';

	let { data } = $props();
	const p = $derived(data.profile);
	const initials = $derived(
		p.displayName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
	);
	const joined = $derived(
		new Date(p.memberSince).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
	);
	const statusMeta = (s: string) =>
		SUGGESTION_STATUS_META[s as keyof typeof SUGGESTION_STATUS_META] ?? { label: s, color: '#9ca3af' };
</script>

<PublicMeta
	title={`${p.displayName} — ${data.siteName}`}
	description={`${p.stats.submitted} pieces of feedback shared · ${p.stats.accepted} accepted or shipped. ${p.displayName} contributes to ${data.siteName} in the open.`}
	type="profile"
/>

<main class="mx-auto max-w-3xl px-4 pt-10 pb-4 sm:px-6 sm:pt-12">
	<!-- Hero: the person, poster-sized. -->
	<section class="ot-rise flex items-center gap-4 sm:gap-5" style="--rise-i:0">
		{#if p.avatarUrl}
			<img src={p.avatarUrl} alt="" class="size-16 shrink-0 rounded-full object-cover shadow-lg ring-2 ring-white dark:ring-neutral-700" />
		{:else}
			<span
				class="grid size-16 shrink-0 place-items-center rounded-full text-xl font-bold text-white shadow-lg"
				style="background:linear-gradient(140deg, color-mix(in oklab, var(--accent) 86%, white), var(--accent))"
			>{initials}</span>
		{/if}
		<div class="min-w-0">
			<h1 class="type-poster text-3xl sm:text-4xl"><BlurText text={p.displayName} animateBy="words" direction="top" delay={70} /></h1>
			<p class="mt-1.5 font-mono text-[12px] text-neutral-400 dark:text-neutral-500">@{p.username} · joined {joined}</p>
		</div>
	</section>

	<!-- Scoreboard -->
	<div class="mt-7 grid grid-cols-2 gap-4">
		<div class="ot-rise" style="--rise-i:1">
			<StatTile value={p.stats.submitted} label="Feedback shared" accent />
		</div>
		<div class="ot-rise" style="--rise-i:2">
			<StatTile value={p.stats.accepted} label="Accepted or shipped" />
		</div>
	</div>

	<!-- Recent suggestions -->
	<section class="mt-10">
		<h2 class="type-poster flex items-center gap-2 text-xl">
			<Lightbulb size={18} class="text-[var(--accent-fg)]" /> Recent suggestions
		</h2>
		{#if p.recent.length}
			<div class="mt-3 space-y-2.5">
				{#each p.recent as s, i (s.id)}
					{@const meta = statusMeta(s.status)}
					<a
						href={`/${s.wsSlug}/${s.projSlug}/suggestions/${s.id}`}
						class="pub-card ot-rise group flex items-center gap-3 p-3.5 transition duration-150 hover:-translate-y-0.5"
						style={`--rise-i:${i + 3}`}
					>
						<span class="flex shrink-0 items-center gap-1 font-mono text-xs text-neutral-400"><ChevronUp size={14} /> {s.votes}</span>
						<span class="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-[var(--accent-fg)]">{s.title}</span>
						<span
							class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
							style={`background:color-mix(in oklab, ${meta.color} 12%, transparent);color:${meta.color}`}
						>{meta.label}</span>
						<span class="hidden shrink-0 font-mono text-[11px] text-neutral-400 sm:block">{s.projName}</span>
					</a>
				{/each}
			</div>
		{:else}
			<div class="pub-card mt-3 rounded-3xl">
				<EmptyState
					icon={Lightbulb}
					title="Nothing on the wall yet"
					body={`When ${p.displayName} shares an idea or reports a bug in public, it lands here.`}
				/>
			</div>
		{/if}
	</section>
</main>
