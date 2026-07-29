<!--
	MonoChangelog — the showcase project's REAL latest published releases as mono
	log lines (version · date · shipped count), newest first, each linking to the
	full versioned changelog. A changelog that reads like a commit log and points
	back at the issues that shipped.
-->
<script lang="ts">
	import type { LandRelease } from './types';

	type Props = { releases: LandRelease[]; base: string };
	let { releases, base }: Props = $props();

	const fmtDate = (d: string | Date | null) =>
		d
			? new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })
			: '--------';
</script>

<section id="changelog" class="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
	<p class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">03 // Changelog</p>
	<div class="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
		<h2 class="mono-display max-w-xl text-2xl leading-tight tracking-tight text-[var(--text)] sm:text-4xl">
			A changelog that links back to the issues.
		</h2>
		<a
			href={`${base}/releases`}
			class="mono-focus shrink-0 text-[13px] tracking-tight text-[var(--dim)] transition-colors hover:text-[var(--accent)]"
		>
			All releases →
		</a>
	</div>

	<ol class="mt-10 border-t border-[var(--rule)]">
		{#each releases as r, i (r.id)}
			<li class="border-b border-[var(--rule)]">
				<a
					href={`${base}/releases`}
					class="mono-focus group flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4 transition-colors"
				>
					<span class="w-[9ch] shrink-0 text-[15px] tracking-tight text-[var(--text)] group-hover:text-[var(--accent)]">
						{r.version}
					</span>
					<span class="shrink-0 text-[12px] tabular-nums text-[var(--faint)]">{fmtDate(r.releasedAt)}</span>
					{#if r.name}
						<span class="min-w-0 flex-1 truncate text-[13px] text-[var(--dim)]">{r.name}</span>
					{:else}
						<span class="flex-1"></span>
					{/if}
					<span class="shrink-0 text-[12px] tabular-nums text-[var(--faint)]">
						{#if i === 0}<span class="mr-2 text-[var(--accent)]">latest</span>{/if}
						{r.ticketCount} shipped
					</span>
				</a>
			</li>
		{/each}
	</ol>
</section>
