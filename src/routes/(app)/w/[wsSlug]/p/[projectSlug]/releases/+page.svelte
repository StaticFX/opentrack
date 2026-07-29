<script lang="ts">
	import { enhance } from '$app/forms';
	import { Tag } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmptyStateApp from '$lib/components/ui/EmptyStateApp.svelte';
	import ViewHeader, { type Crumb } from '$lib/components/app/ViewHeader.svelte';
	import { PROJECT_NAV } from '$lib/projectNav';

	let { data, form } = $props();
	const wsSlug = $derived(data.workspace?.slug ?? '');
	const projSlug = $derived(data.project.slug);
	const base = $derived(`/w/${wsSlug}/p/${projSlug}`);
	let showForm = $state(false);

	const crumbs = $derived<Crumb[]>([
		{
			label: data.project.name,
			href: base,
			dot: data.project.color ?? undefined,
			menu:
				(data.projects?.length ?? 0) > 1
					? data.projects.map((p) => ({ label: p.name, href: `/w/${wsSlug}/p/${p.slug}`, current: p.slug === projSlug }))
					: undefined
		},
		{
			label: 'Releases',
			menu: [
				...data.boards.map((b) => ({ label: b.name, href: `${base}/b/${b.id}` })),
				...PROJECT_NAV.filter((i) => !i.external && (!i.manageOnly || data.canManageProject)).map((i) => ({
					label: i.label,
					href: i.href(wsSlug, projSlug),
					current: i.key === 'releases'
				}))
			]
		}
	]);

	const shipped = $derived(data.releases.filter((r) => r.status === 'published').length);
</script>

<svelte:head><title>Releases · {data.project.name} · OpenTrack</title></svelte:head>

<ViewHeader {crumbs} live={{ text: `${shipped} shipped` }} tabs>
	{#snippet actions()}
		{#if !showForm}
			<Button variant="accent" size="sm" onclick={() => (showForm = true)}><Tag size={15} /> New release</Button>
		{/if}
	{/snippet}
</ViewHeader>

<div class="view-5xl">
	<div class="mx-auto max-w-3xl">
		{#if showForm}
			<form method="POST" action="?/create" use:enhance class="mb-4 flex flex-wrap items-end gap-2 border border-[var(--rule)] p-3.5">
				<Field label="Version"><Input name="version" placeholder="v1.2.0" required autofocus class="data-mono w-32" /></Field>
				<Button variant="accent" size="sm" type="submit">Create</Button>
				<Button variant="ghost" size="sm" type="button" onclick={() => (showForm = false)}>Cancel</Button>
			</form>
		{/if}

		{#if form?.error}<p class="mb-3 text-[13px] text-[#f85149]">{form.error}</p>{/if}

		{#if data.releases.length}
			<p class="mb-3 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Log</p>
			<ol class="border-t border-[var(--rule)]">
				{#each data.releases as r (r.id)}
					<li class="border-b border-[var(--rule)]">
						<a href={`${base}/releases/${r.id}`} class="mono-focus group flex items-center gap-3.5 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)]">
							<Tag size={14} class="shrink-0 text-[var(--faint)]" aria-hidden="true" />
							<span class="min-w-0 flex-1">
								<span class="flex items-baseline gap-2">
									<span class="mono-display text-[15px] text-[var(--text)] group-hover:text-[var(--accent)]">{r.version}</span>
									{#if r.name}<span class="truncate text-[13px] text-[var(--dim)]">{r.name}</span>{/if}
								</span>
								{#if r.releasedAt}<span class="data-mono mt-0.5 block text-[var(--faint)]">{new Date(r.releasedAt).toLocaleDateString()}</span>{/if}
							</span>
							<Badge tone={r.status === 'published' ? 'green' : 'neutral'} class="shrink-0">{r.status}</Badge>
						</a>
					</li>
				{/each}
			</ol>
		{:else}
			<EmptyStateApp icon={Tag} title="No releases yet." body="Create one to start a public changelog." />
		{/if}
	</div>
</div>
