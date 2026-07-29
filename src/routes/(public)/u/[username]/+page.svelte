<script lang="ts">
	import { Lightbulb } from '@lucide/svelte';
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
		SUGGESTION_STATUS_META[s as keyof typeof SUGGESTION_STATUS_META] ?? { label: s, color: 'var(--faint)' };
</script>

<PublicMeta
	title={`${p.displayName} — ${data.siteName}`}
	description={`${p.stats.submitted} pieces of feedback shared · ${p.stats.accepted} accepted or shipped. ${p.displayName} contributes to ${data.siteName} in the open.`}
	type="profile"
/>

<main class="mx-auto max-w-3xl px-4 pt-12 pb-16 sm:px-6 sm:pt-14">
	<!-- Hero: identity, type on the ground. No card. -->
	<section class="flex items-start gap-4 sm:gap-5">
		{#if p.avatarUrl}
			<img src={p.avatarUrl} alt="" class="mt-1 size-14 shrink-0 rounded-full object-cover" />
		{:else}
			<span
				class="mono-display mt-1 grid size-14 shrink-0 place-items-center rounded-full text-lg text-[var(--ground)]"
				style="background:var(--accent)"
			>{initials}</span>
		{/if}
		<div class="min-w-0">
			<h1 class="mono-display text-3xl leading-[1.05] tracking-tight text-[var(--text)] sm:text-4xl">
				<BlurText text={p.displayName} animateBy="words" direction="top" delay={70} />
			</h1>
			<p class="mt-2 text-[12px] tracking-tight text-[var(--faint)]">@{p.username} · joined {joined}</p>
		</div>
	</section>

	<!-- Scoreboard -->
	<div class="mt-8 grid grid-cols-2 gap-6 border-t border-[var(--rule)] pt-6">
		<div class="ot-rise" style="--rise-i:1">
			<StatTile value={p.stats.submitted} label="Feedback shared" accent />
		</div>
		<div class="ot-rise" style="--rise-i:2">
			<StatTile value={p.stats.accepted} label="Accepted or shipped" />
		</div>
	</div>

	<!-- Recent suggestions -->
	<section class="mt-12">
		<p class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">01 // Recent suggestions</p>
		{#if p.recent.length}
			<ul class="mt-4 border-t border-[var(--rule)]">
				{#each p.recent as s, i (s.id)}
					{@const meta = statusMeta(s.status)}
					<li class="ot-rise border-b border-[var(--rule)]" style={`--rise-i:${i + 3}`}>
						<a
							href={`/${s.wsSlug}/${s.projSlug}/suggestions/${s.id}`}
							class="mono-focus group flex items-center gap-4 py-3.5"
						>
							<span class="shrink-0 text-[13px] tabular-nums text-[var(--faint)]">▲ {s.votes}</span>
							<span class="min-w-0 flex-1 truncate text-[15px] tracking-tight text-[var(--text)] transition-colors group-hover:text-[var(--accent)]">{s.title}</span>
							<span class="shrink-0 text-[11px] tracking-wide uppercase" style={`color:${meta.color}`}>{meta.label}</span>
							<span class="hidden shrink-0 text-[11px] text-[var(--faint)] sm:block">{s.projName}</span>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<div class="mt-4 border-t border-[var(--rule)]">
				<EmptyState
					icon={Lightbulb}
					title="No public feedback yet"
					body={`When ${p.displayName} shares an idea or reports a bug in public, it lands here.`}
				/>
			</div>
		{/if}
	</section>
</main>
