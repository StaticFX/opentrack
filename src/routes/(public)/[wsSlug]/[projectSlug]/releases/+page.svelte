<script lang="ts">
	import { Tag, Download, ExternalLink, FileText, Rss } from '@lucide/svelte';
	import { renderMarkdown } from '$lib/markdown';

	let { data } = $props();
	const base = $derived(`/${data.workspace.slug}/${data.project.slug}`);
	const feed = $derived(`${base}/releases/rss.xml`);

	const linkIcon = (type: string) => (type === 'download' ? Download : type === 'changelog' ? FileText : ExternalLink);
</script>

<svelte:head>
	<title>Releases — {data.project.name}</title>
	<link rel="alternate" type="application/rss+xml" title={`${data.project.name} releases`} href={feed} />
</svelte:head>

<main class="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
	<div class="mb-4 flex justify-end">
		<a href={feed} class="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-orange-500"><Rss size={13} /> RSS</a>
	</div>
	{#if data.releases.length}
		<div class="space-y-10">
			{#each data.releases as r (r.id)}
				<article class="border-l-2 border-neutral-200 pl-5 dark:border-neutral-800">
					<div class="flex items-center gap-2">
						<Tag size={16} class="text-brand-600" />
						<h2 class="text-lg font-bold tracking-tight">{r.version}{#if r.name} <span class="font-normal text-neutral-500">— {r.name}</span>{/if}</h2>
					</div>
					{#if r.releasedAt}<p class="mt-0.5 text-xs text-neutral-400">{new Date(r.releasedAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>{/if}

					{#if r.notes}<div class="prose prose-sm dark:prose-invert mt-3 max-w-none">{@html renderMarkdown(r.notes)}</div>{/if}

					{#if r.links.length}
						<div class="mt-4 flex flex-wrap gap-2">
							{#each r.links as l (l.url)}
								{@const Icon = linkIcon(l.type)}
								<a href={l.url} target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
									<Icon size={14} /> {l.label}
								</a>
							{/each}
						</div>
					{/if}

					{#if r.tickets.length}
						<div class="mt-4">
							<p class="mb-1 text-xs font-medium text-neutral-400">Shipped</p>
							<ul class="space-y-0.5">
								{#each r.tickets as t (t.id)}
									<li class="text-sm"><a href={`${base}/t/${t.number}`} class="hover:underline"><span class="font-mono text-neutral-400">#{t.number}</span> {t.title}</a></li>
								{/each}
							</ul>
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{:else}
		<div class="py-20 text-center text-sm text-neutral-400">No releases published yet.</div>
	{/if}
</main>
