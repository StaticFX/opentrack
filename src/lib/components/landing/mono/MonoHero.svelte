<!--
	MonoHero — a LEFT-ALIGNED typographic statement, not a centered card grid.
	Big Space Mono headline set tight; a specific JetBrains Mono subhead; one accent
	CTA into the live demo + a quiet GitHub secondary; the real instance totals as a
	mono data line. Below it, asymmetric, the REAL board as the one bordered panel.
-->
<script lang="ts">
	import MonoBoard from './MonoBoard.svelte';
	import type { ShowcaseData, LandTotals } from './types';

	type Props = { showcase: ShowcaseData | null; totals: LandTotals; siteName: string };
	let { showcase, totals }: Props = $props();

	const base = $derived(showcase ? `/${showcase.wsSlug}/${showcase.slug}` : '');
</script>

<section id="top" class="mx-auto max-w-5xl px-5 pt-16 pb-10 sm:px-8 sm:pt-24">
	<p class="text-[12px] tracking-[0.18em] text-[var(--faint)] uppercase">
		Self-hosted // Public by default // Open source
	</p>

	<h1
		class="mono-display mt-6 max-w-3xl text-[2.5rem] leading-[0.98] tracking-[-0.02em] text-[var(--text)] sm:text-6xl lg:text-[4.5rem]"
	>
		Issue tracking,<br />for communities.
	</h1>

	<p class="mt-7 max-w-xl text-[15px] leading-relaxed text-[var(--dim)] sm:text-base">
		OpenTrack is a self-hosted tracker that puts your board, roadmap, and changelog on public
		URLs. Your community can see what you're building and vote on what comes next — without an
		account.
	</p>

	<div class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px]">
		<a
			href={showcase ? base : 'https://github.com/StaticFX/opentrack'}
			class="mono-focus inline-flex items-center gap-2 border border-[var(--accent)] bg-[var(--accent)] px-5 py-2.5 font-medium tracking-tight text-[var(--ground)] transition-colors hover:bg-transparent hover:text-[var(--accent)]"
		>
			{showcase ? 'See the live demo' : 'View the source'} →
		</a>
		<a
			href="https://github.com/StaticFX/opentrack"
			class="mono-focus tracking-tight text-[var(--dim)] transition-colors hover:text-[var(--accent)]"
		>
			GitHub ↗
		</a>
	</div>

	{#if totals.projects > 0}
		<p class="mt-8 border-t border-[var(--rule)] pt-4 text-[12px] tracking-tight text-[var(--faint)]">
			<span class="tabular-nums text-[var(--accent)]">{totals.projects}</span>
			{totals.projects === 1 ? 'project' : 'projects'} building in the open ·
			<span class="tabular-nums text-[var(--accent)]">{totals.open}</span> open ·
			<span class="tabular-nums text-[var(--accent)]">{totals.shipped}</span> shipped
		</p>
	{/if}
</section>

{#if showcase}
	<section class="mx-auto max-w-5xl px-5 pb-16 sm:px-8 sm:pb-20">
		<div class="mb-3 flex items-baseline justify-between gap-4">
			<p class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">
				00 // {showcase.name} — live board
			</p>
			<a
				href={base}
				class="mono-focus hidden text-[11px] tracking-tight text-[var(--dim)] transition-colors hover:text-[var(--accent)] sm:inline"
			>
				open project →
			</a>
		</div>
		<MonoBoard
			columns={showcase.columns}
			boardId={showcase.boardId}
			{base}
			wsSlug={showcase.wsSlug}
			slug={showcase.slug}
			ticketTotal={showcase.ticketTotal}
		/>
	</section>
{/if}
