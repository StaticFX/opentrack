<!--
	MonoDirectory — every public workspace/project on this instance, straight from
	the loader. A typeset mono list grouped by workspace (NOT cards): real names,
	real open/shipped counts, an accent activity dot for projects touched in the last
	48h. Each row links to the real project.
-->
<script lang="ts">
	import type { DirectoryWorkspace, LandTotals } from './types';

	type Props = { workspaces: DirectoryWorkspace[]; totals: LandTotals };
	let { workspaces, totals }: Props = $props();

	const ACTIVE_WINDOW_MS = 48 * 60 * 60 * 1000;
	const isActive = (t: Date | string | null): boolean =>
		t != null && Date.now() - new Date(t).getTime() < ACTIVE_WINDOW_MS;
</script>

<section id="directory" class="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
	<p class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">04 // Directory</p>
	<div class="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
		<h2 class="mono-display text-2xl leading-tight tracking-tight text-[var(--text)] sm:text-4xl">
			Public projects on this instance.
		</h2>
		<p class="shrink-0 text-[12px] tracking-tight text-[var(--faint)]">
			<span class="tabular-nums text-[var(--dim)]">{totals.projects}</span>
			{totals.projects === 1 ? 'project' : 'projects'} ·
			<span class="tabular-nums text-[var(--dim)]">{totals.open}</span> open ·
			<span class="tabular-nums text-[var(--dim)]">{totals.shipped}</span> shipped
		</p>
	</div>

	<div class="mt-10 space-y-10">
		{#each workspaces as ws (ws.slug)}
			<div>
				<a
					href={`/${ws.slug}`}
					class="mono-focus group flex items-baseline justify-between gap-4 border-b border-[var(--rule)] pb-2.5"
				>
					<span class="flex min-w-0 items-baseline gap-2">
						{#if ws.icon}<span aria-hidden="true">{ws.icon}</span>{/if}
						<span class="truncate text-[15px] tracking-tight text-[var(--text)] group-hover:text-[var(--accent)]">
							{ws.name}
						</span>
						<span class="text-[12px] text-[var(--faint)]">/</span>
					</span>
					<span class="shrink-0 text-[11px] tabular-nums text-[var(--faint)]">
						{ws.projects.length} {ws.projects.length === 1 ? 'project' : 'projects'}
					</span>
				</a>

				<ul>
					{#each ws.projects as p (p.slug)}
						<li class="border-b border-[var(--rule)]">
							<a
								href={`/${ws.slug}/${p.slug}`}
								class="mono-focus group flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3"
							>
								<span class="flex shrink-0 items-baseline gap-1.5">
									{#if isActive(p.stats.lastActivityAt)}
										<span class="live-dot inline-block size-1.5 rounded-full" title="Active in the last 48h" aria-hidden="true"></span>
									{/if}
									<span class="text-[14px] tracking-tight text-[var(--text)] group-hover:text-[var(--accent)]">
										{p.name}
									</span>
								</span>
								{#if p.description}
									<span class="min-w-0 flex-1 truncate text-[12px] text-[var(--dim)]">— {p.description}</span>
								{:else}
									<span class="flex-1"></span>
								{/if}
								<span class="shrink-0 text-[12px] tabular-nums text-[var(--faint)]">
									<span class="text-[var(--dim)]">{p.stats.open}</span> open ·
									<span class="text-[var(--dim)]">{p.stats.shipped}</span> shipped →
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</section>

<style>
	.live-dot {
		background: var(--accent);
	}
	@media (prefers-reduced-motion: no-preference) {
		.live-dot {
			animation: mono-dot 1.9s ease-in-out infinite;
		}
	}
	@keyframes mono-dot {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
