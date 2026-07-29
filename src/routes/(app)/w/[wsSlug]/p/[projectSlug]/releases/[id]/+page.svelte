<script lang="ts">
	import { flushSync } from 'svelte';
	import { enhance } from '$app/forms';
	import { Rocket, Trash2, ExternalLink, Plus } from '@lucide/svelte';
	import { RELEASE_LINK_TYPES } from '$lib/constants';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import ViewHeader, { type Crumb } from '$lib/components/app/ViewHeader.svelte';
	import { PROJECT_NAV } from '$lib/projectNav';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);
	const r = $derived(data.detail.release);

	const wsSlug = $derived(data.workspace.slug);
	const projSlug = $derived(data.project.slug);
	const base = $derived(`/w/${wsSlug}/p/${projSlug}`);

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
			href: `${base}/releases`,
			menu: [
				...data.boards.map((b) => ({ label: b.name, href: `${base}/b/${b.id}` })),
				...PROJECT_NAV.filter((i) => !i.external && (!i.manageOnly || data.canManageProject)).map((i) => ({
					label: i.label,
					href: i.href(wsSlug, projSlug),
					current: i.key === 'releases'
				}))
			]
		},
		{ label: r.version }
	]);

	let status = $state(r.status);
	let notesDraft = $state(r.notes ?? '');
	let genMsg = $state('');
	const statusOptions = [
		{ value: 'draft', label: 'Draft' },
		{ value: 'published', label: 'Published' }
	];
	const linkTypeOptions = RELEASE_LINK_TYPES.map((t) => ({ value: t, label: t }));

	// Publish (header CTA): a Tier-2 confirm that resubmits the SAME `?/update`
	// form the Save button uses, with status flipped — no parallel field state.
	let releaseFormEl = $state<HTMLFormElement>();
	let confirmPublishOpen = $state(false);
	function confirmPublish() {
		flushSync(() => (status = 'published'));
		confirmPublishOpen = false;
		releaseFormEl?.requestSubmit();
	}

	// Delete: keep the real `<form action="?/delete">` as the JS-less path
	// (it just posts on click, like before); a JS submit-intercept swaps the
	// native confirm() for the styled Tier-2 Dialog, then re-submits for real.
	let deleteFormEl = $state<HTMLFormElement>();
	let confirmDeleteOpen = $state(false);
	let deleteConfirmed = false;
	function onDeleteSubmit(e: SubmitEvent) {
		if (deleteConfirmed) return;
		e.preventDefault();
		confirmDeleteOpen = true;
	}
	function confirmDelete() {
		confirmDeleteOpen = false;
		deleteConfirmed = true;
		deleteFormEl?.requestSubmit();
	}
</script>

<svelte:head><title>{r.version} · {data.project.name} · OpenTrack</title></svelte:head>

<ViewHeader {crumbs} tabs>
	{#snippet actions()}
		{#if r.status !== 'published'}
			<Button variant="accent" size="sm" onclick={() => (confirmPublishOpen = true)}><Rocket size={14} /> Publish</Button>
		{/if}
	{/snippet}
</ViewHeader>

<div class="view-5xl">
	<div class="mx-auto max-w-2xl">
		<!-- Identity: version is display voice, state pill reflects what's saved. -->
		<div class="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
			<h1 class="mono-display text-2xl text-[var(--text)]">{r.version}</h1>
			{#if r.name}<span class="min-w-0 truncate text-lg text-[var(--dim)]">{r.name}</span>{/if}
			<Badge tone={r.status === 'published' ? 'green' : 'neutral'}>{r.status}</Badge>
		</div>

		<!-- Details -->
		<section>
			<p class="mb-3 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Details</p>
			<form
				bind:this={releaseFormEl}
				method="POST"
				action="?/update"
				use:enhance={() => async ({ result, update }) => {
					const d = result.type === 'success' ? (result.data as Record<string, unknown> | undefined) : undefined;
					// The "Generate" button posts to ?/generateNotes and returns a draft;
					// apply it into the editor instead of running the normal update flow.
					if (d && ('draft' in d || 'empty' in d)) {
						if (d.draft) {
							notesDraft = String(d.draft);
							genMsg = 'Draft generated from shipped tickets — edit before saving.';
						} else genMsg = 'No tickets shipped since the last release.';
						return;
					}
					await update({ reset: false });
				}}
				class="flex flex-col gap-4"
			>
				<div class="flex gap-3">
					<Field label="Version"><Input name="version" value={r.version} required class="data-mono w-40" /></Field>
					<div class="flex-1"><Field label="Name (optional)"><Input name="name" value={r.name ?? ''} /></Field></div>
				</div>
				<div>
					<div class="mb-1 flex items-center justify-between">
						<span class="text-[13px] text-[var(--dim)]">Release notes (markdown)</span>
						<Button variant="ghost" size="sm" type="submit" formaction="?/generateNotes">Generate from shipped tickets</Button>
					</div>
					<Textarea name="notes" rows={8} bind:value={notesDraft} />
					{#if genMsg}<p class="mt-1 text-[11px] text-[var(--faint)]">{genMsg}</p>{/if}
				</div>
				<div class="flex items-end justify-between">
					<Field label="Status"><input type="hidden" name="status" value={status} /><Select bind:value={status} options={statusOptions} class="w-40" /></Field>
					<div class="flex items-center gap-3">
						{#if f?.saved}<span class="text-[13px] text-[var(--green)]">Saved</span>{/if}
						<Button variant="accent" type="submit">Save</Button>
					</div>
				</div>
			</form>
		</section>

		<!-- Links -->
		<section class="mt-8 border-t border-[var(--rule)] pt-6">
			<p class="mb-3 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Links</p>
			{#if data.detail.links.length}
				<ul class="mb-3 border-t border-[var(--rule)]">
					{#each data.detail.links as l (l.id)}
						<li class="flex items-center justify-between border-b border-[var(--rule)] py-2 text-[13px]">
							<a href={l.url} target="_blank" rel="noopener" class="mono-focus flex items-center gap-1.5 text-[var(--accent-fg)] transition-colors hover:text-[var(--accent)]">
								<ExternalLink size={13} /> {l.label} <span class="data-mono font-normal text-[var(--faint)]">({l.type})</span>
							</a>
							<form method="POST" action="?/removeLink" use:enhance>
								<input type="hidden" name="linkId" value={l.id} />
								<button class="hit mono-focus rounded-[3px] p-1 text-[var(--faint)] transition-colors hover:text-[#f85149]" aria-label="Remove link"><Trash2 size={14} /></button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
			<form method="POST" action="?/addLink" use:enhance class="flex flex-wrap items-end gap-2">
				<Field label="Label"><Input name="label" placeholder="Download" class="w-32" /></Field>
				<div class="min-w-40 flex-1"><Field label="URL"><Input name="url" type="url" placeholder="https://…" /></Field></div>
				<Field label="Type"><Select name="type" options={linkTypeOptions} value="external" class="w-32" /></Field>
				<Button variant="default" type="submit"><Plus size={14} /> Add</Button>
			</form>
		</section>

		<!-- Shipped tickets -->
		<section class="mt-8 border-t border-[var(--rule)] pt-6">
			<p class="mb-3 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Shipped in this release</p>
			{#if data.detail.tickets.length}
				<ul class="mb-3 border-t border-[var(--rule)]">
					{#each data.detail.tickets as t (t.id)}
						<li class="flex items-center justify-between border-b border-[var(--rule)] px-1 py-1.5 text-[13px] transition-colors hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)]">
							<span class="min-w-0 truncate text-[var(--text)]"><span class="data-mono text-[var(--faint)]">#{t.number}</span> {t.title}</span>
							<form method="POST" action="?/removeTicket" use:enhance>
								<input type="hidden" name="ticketId" value={t.id} />
								<button class="hit mono-focus rounded-[3px] p-1 text-[var(--faint)] transition-colors hover:text-[#f85149]" aria-label="Remove"><Trash2 size={13} /></button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
			<form method="POST" action="?/addTicket" use:enhance class="flex items-end gap-2">
				<Field label="Ticket #"><Input name="number" type="number" min="1" placeholder="42" class="data-mono w-24" /></Field>
				<Button variant="default" type="submit"><Plus size={14} /> Add</Button>
			</form>
			{#if f?.error}<p class="mt-2 text-[13px] text-[#f85149]">{f.error}</p>{/if}
		</section>

		<!-- Danger -->
		<section class="mt-8 border-t border-[var(--rule)] pt-6">
			<form bind:this={deleteFormEl} method="POST" action="?/delete" use:enhance onsubmit={onDeleteSubmit}>
				<Button variant="danger" type="submit"><Trash2 size={14} /> Delete release</Button>
			</form>
		</section>
	</div>
</div>

<!-- Publish confirm — Tier 2. Resubmits the details form above with status=published. -->
<Dialog bind:open={confirmPublishOpen} title="Publish this release?" description={`v${r.version.replace(/^v/, '')} becomes visible on the public changelog.`}>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (confirmPublishOpen = false)}>Cancel</Button>
		<Button variant="accent" onclick={confirmPublish}><Rocket size={14} /> Publish</Button>
	{/snippet}
</Dialog>

<!-- Delete confirm — Tier 2, styled replacement for native confirm(). -->
<Dialog bind:open={confirmDeleteOpen} title="Delete this release?" description={`"${r.version}" will be permanently removed.`}>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (confirmDeleteOpen = false)}>Cancel</Button>
		<Button variant="danger" onclick={confirmDelete}>Delete release</Button>
	{/snippet}
</Dialog>
