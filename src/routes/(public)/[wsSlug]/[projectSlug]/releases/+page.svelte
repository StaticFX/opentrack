<script lang="ts">
	import { Tag, Download, ExternalLink, FileText, Rss, PackageOpen, CircleCheckBig } from '@lucide/svelte';
	import { renderMarkdown } from '$lib/markdown';
	import EmptyState from '$lib/components/public/EmptyState.svelte';
	import PublicMeta from '$lib/components/public/PublicMeta.svelte';

	let { data } = $props();
	const base = $derived(`/${data.workspace.slug}/${data.project.slug}`);
	const feed = $derived(`${base}/releases/rss.xml`);
	const latest = $derived(data.releases[0]);

	const linkIcon = (type: string) => (type === 'download' ? Download : type === 'changelog' ? FileText : ExternalLink);
	const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString(undefined, { dateStyle: 'long' });
</script>

<PublicMeta
	title={`${data.project.name} releases`}
	description={latest ? `Latest: ${latest.version}${latest.name ? ` — ${latest.name}` : ''}` : `Releases of ${data.project.name}.`}
/>

<main class="mx-auto max-w-3xl px-4 py-6 sm:px-6">
	{#if data.releases.length}
		<div class="mb-5 flex items-center justify-between">
			<p class="font-mono text-[11px] font-medium text-neutral-400">{data.releases.length} {data.releases.length === 1 ? 'release' : 'releases'}</p>
			<a href={feed} class="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium text-neutral-400 transition-colors hover:bg-black/5 hover:text-orange-500 dark:hover:bg-white/10"><Rss size={13} /> RSS</a>
		</div>

		<!-- Timeline -->
		<div class="relative space-y-8 pl-10">
			<div class="absolute inset-y-2 left-3.5 w-px" style="background:linear-gradient(to bottom, var(--accent), color-mix(in oklab, var(--accent) 20%, transparent) 40%, transparent)"></div>

			{#each data.releases as r, i (r.id)}
				<article class="ot-rise relative" style={`--rise-i:${Math.min(i, 6) * 2}`}>
					<span
						class={`absolute top-4 -left-10 grid size-7 place-items-center rounded-full shadow-sm ${i === 0 ? 'text-white' : 'border border-black/10 bg-white text-neutral-400 dark:border-white/10 dark:bg-neutral-800'}`}
						style={i === 0 ? 'background:var(--accent-solid)' : ''}
					>
						{#if i === 0}<span class="absolute inset-0 rounded-full ot-breathe" style="background:var(--accent)" aria-hidden="true"></span>{/if}
						<Tag size={13} class="relative" />
					</span>

					<div class={`pub-card rounded-3xl p-5 ${i === 0 ? 'ring-1 ring-[var(--accent-border)]' : ''}`}>
						<div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
							<h2 class="type-poster text-xl">{r.version}</h2>
							{#if r.name}<span class="text-sm text-neutral-500 dark:text-neutral-400">{r.name}</span>{/if}
							{#if i === 0}
								<span class="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-white uppercase" style="background:var(--accent-solid)">Latest</span>
							{/if}
							{#if r.releasedAt}<span class="ml-auto font-mono text-[11px] text-neutral-400">{fmtDate(r.releasedAt)}</span>{/if}
						</div>

						{#if r.notes}<div class="prose prose-sm dark:prose-invert mt-3 max-w-none">{@html renderMarkdown(r.notes)}</div>{/if}

						{#if r.links.length}
							<div class="mt-4 flex flex-wrap gap-2">
								{#each r.links as l (l.url)}
									{@const Icon = linkIcon(l.type)}
									<a
										href={l.url}
										target="_blank"
										rel="noopener"
										class={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${l.type === 'download' ? 'text-white shadow-sm hover:bg-[var(--accent-solid-hover)]' : 'border border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10'}`}
										style={l.type === 'download' ? 'background:var(--accent-solid)' : ''}
									>
										<Icon size={14} /> {l.label}
									</a>
								{/each}
							</div>
						{/if}

						{#if r.tickets.length}
							<div class="mt-4 rounded-2xl bg-black/[0.03] p-3 dark:bg-white/[0.04]">
								<p class="pub-label mb-1.5 flex items-center gap-1.5">
									<PackageOpen size={13} /> Shipped in this release
								</p>
								<ul class="space-y-1">
									{#each r.tickets as t (t.id)}
										<li>
											<a href={`${base}/t/${t.number}`} class="group flex items-start gap-1.5 text-sm">
												<CircleCheckBig size={14} class="mt-0.5 shrink-0 text-green-500" />
												<span class="group-hover:underline"><span class="font-mono text-xs text-neutral-400">#{t.number}</span> {t.title}</span>
											</a>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{:else}
		<div class="pub-card rounded-3xl">
			<EmptyState icon={PackageOpen} title="Nothing shipped yet" body="Releases will appear here as they go out." />
		</div>
	{/if}
</main>
