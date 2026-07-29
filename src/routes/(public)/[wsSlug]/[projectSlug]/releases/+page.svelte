<script lang="ts">
	import { Tag, Download, ExternalLink, FileText, Rss, PackageOpen, CircleCheckBig } from '@lucide/svelte';
	import { renderMarkdown } from '$lib/markdown';
	import EmptyState from '$lib/components/public/EmptyState.svelte';
	import PublicMeta from '$lib/components/public/PublicMeta.svelte';
	import { cn } from '$lib/utils/cn';

	let { data } = $props();
	const base = $derived(`/${data.workspace.slug}/${data.project.slug}`);
	const feed = $derived(`${base}/releases/rss.xml`);
	const latest = $derived(data.releases[0]);

	const linkIcon = (type: string) => (type === 'download' ? Download : type === 'changelog' ? FileText : ExternalLink);
	const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString(undefined, { dateStyle: 'long' });

	// The latest release stays fully open; older entries clamp to their first
	// paragraph or so, with an explicit expand — the log can't turn into a
	// long-notes scroll-fest for anything below the fold.
	let expandedIds = $state<string[]>([]);
	const isOpen = (i: number, id: string) => i === 0 || expandedIds.includes(id);
</script>

<PublicMeta
	title={`${data.project.name} releases`}
	description={latest ? `Latest: ${latest.version}${latest.name ? ` — ${latest.name}` : ''}` : `Releases of ${data.project.name}.`}
/>

<main class="mx-auto max-w-3xl px-4 py-6 sm:px-6">
	{#if data.releases.length}
		<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
			<p class="text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Releases</p>
			<div class="flex items-center gap-4">
				<span class="text-[11px] tabular-nums text-[var(--faint)]"
					>{data.releases.length} {data.releases.length === 1 ? 'release' : 'releases'}</span
				>
				<a
					href={feed}
					class="mono-focus flex items-center gap-1.5 text-[11px] tracking-tight text-[var(--faint)] transition-colors hover:text-[var(--accent)]"
				>
					<Rss size={12} /> RSS
				</a>
			</div>
		</div>

		<!-- Release log -->
		<ol class="mt-6 border-t border-[var(--rule)]">
			{#each data.releases as r, i (r.id)}
				{@const open = isOpen(i, r.id)}
				<li class="ot-rise border-b border-[var(--rule)] py-8" style={`--rise-i:${i}`}>
					<article>
						<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
							<Tag size={14} class="shrink-0 text-[var(--faint)]" aria-hidden="true" />
							<h2 class="mono-display text-xl tracking-tight text-[var(--text)] sm:text-2xl">{r.version}</h2>
							{#if r.name}<span class="text-[14px] text-[var(--dim)]">{r.name}</span>{/if}
							{#if i === 0}<span class="text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase">latest</span>{/if}
							{#if r.releasedAt}
								<span class="ml-auto shrink-0 text-[11px] tabular-nums text-[var(--faint)]">{fmtDate(r.releasedAt)}</span>
							{/if}
						</div>

						{#if r.notes}
							<div class={cn('prose prose-sm prose-invert mt-4 max-w-none text-[var(--dim)]', !open && 'line-clamp-4')}>
								{@html renderMarkdown(r.notes)}
							</div>
							{#if !open}
								<button
									type="button"
									onclick={() => (expandedIds = [...expandedIds, r.id])}
									class="mono-focus mt-2 text-[11px] tracking-tight text-[var(--dim)] transition-colors hover:text-[var(--accent)]"
								>
									Read more →
								</button>
							{/if}
						{/if}

						{#if r.links.length}
							<div class="mt-4 flex flex-wrap gap-2">
								{#each r.links as l (l.url)}
									{@const Icon = linkIcon(l.type)}
									<a
										href={l.url}
										target="_blank"
										rel="noopener"
										class="mono-focus inline-flex items-center gap-1.5 border border-[var(--rule)] px-3 py-1.5 text-[12px] tracking-tight text-[var(--dim)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
									>
										<Icon size={13} /> {l.label}
									</a>
								{/each}
							</div>
						{/if}

						{#if r.tickets.length}
							<div class="mt-5">
								<p class="flex items-center gap-1.5 text-[10px] tracking-[0.16em] text-[var(--faint)] uppercase">
									<PackageOpen size={12} /> Shipped in this release
								</p>
								<ul class="mt-2">
									{#each r.tickets as t (t.id)}
										<li>
											<a href={`${base}/t/${t.number}`} class="mono-focus group flex items-baseline gap-2 py-1">
												<CircleCheckBig size={12} class="shrink-0 translate-y-[1px]" style="color:var(--green)" />
												<span class="shrink-0 text-[11px] tabular-nums text-[var(--faint)]">#{t.number}</span>
												<span class="min-w-0 truncate text-[13px] text-[var(--dim)] group-hover:text-[var(--text)]">{t.title}</span>
											</a>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					</article>
				</li>
			{/each}
		</ol>
	{:else}
		<div class="border-t border-[var(--rule)] pt-10">
			<EmptyState icon={PackageOpen} title="Nothing shipped yet" body="Releases will appear here as they go out." />
		</div>
	{/if}
</main>
